<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('UTC');

$contentType = isset($_SERVER['CONTENT_TYPE'])
    ? $_SERVER['CONTENT_TYPE']
    : (isset($_SERVER['HTTP_CONTENT_TYPE']) ? $_SERVER['HTTP_CONTENT_TYPE'] : '');
if (stripos($contentType, 'application/json') !== 0) {
    errorResponse('Content-Type must be application/json.');
}

$SECRET = 'CHANGE_THIS_SECRET_BEFORE_PRODUCTION';
$STORE_FILES = [
    'users',
    'profiles',
    'sessions',
    'forumThreads',
    'forumPosts',
    'blogPosts',
    'calendarEvents',
    'notifications',
    'reactions',
    'bookmarks',
    'activityFeed',
    'conversations',
    'messages',
    'reports',
    'moderationLogs',
    'userWarnings',
    'userSuspensions',
    'reputation',
    'userBadges',
    'mediaLibrary',
    'contentCategories',
    'contentTags',
    'contentRevisions',
    'searchIndex',
    'settings',
    'moduleData',
    'packages'
];
$BASE_DIR = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'database';
$CIPHER = PHP_VERSION_ID >= 70100 && in_array('aes-256-gcm', openssl_get_cipher_methods(), true)
    ? 'aes-256-gcm'
    : 'aes-256-cbc';
$KEY = hash('sha256', $SECRET, true);

function respond($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse($message, $status = 400) {
    respond(['error' => $message], $status);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Only POST requests are allowed.', 405);
}

$body = file_get_contents('php://input');
if (!$body) {
    errorResponse('Request body is empty.');
}

$data = json_decode($body, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    errorResponse('Invalid JSON payload.');
}

$action = isset($data['action']) ? $data['action'] : null;
$store = isset($data['store']) ? $data['store'] : null;

$allowedActions = ['list', 'get', 'put', 'update', 'remove', 'clear', 'export'];
if (!is_string($action) || !in_array($action, $allowedActions, true)) {
    errorResponse('Unknown action.');
}

if (!is_string($store) || !in_array($store, $STORE_FILES, true)) {
    errorResponse('Invalid store name.');
}

if (!is_dir($BASE_DIR)) {
    if (!mkdir($BASE_DIR, 0755, true) && !is_dir($BASE_DIR)) {
        errorResponse('Unable to initialize database directory.');
    }
}

$storePath = $BASE_DIR . DIRECTORY_SEPARATOR . $store . '.enc';

function encryptData($plaintext) {
    global $CIPHER, $KEY;
    $ivLength = openssl_cipher_iv_length($CIPHER);
    $iv = openssl_random_pseudo_bytes($ivLength);
    if ($CIPHER === 'aes-256-gcm') {
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, $CIPHER, $KEY, OPENSSL_RAW_DATA, $iv, $tag);
        if ($ciphertext === false) {
            errorResponse('Encryption failed.');
        }
        return json_encode([
            'cipher' => $CIPHER,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($ciphertext)
        ], JSON_UNESCAPED_UNICODE);
    }
    $ciphertext = openssl_encrypt($plaintext, $CIPHER, $KEY, OPENSSL_RAW_DATA, $iv);
    if ($ciphertext === false) {
        errorResponse('Encryption failed.');
    }
    return json_encode([
        'cipher' => $CIPHER,
        'iv' => base64_encode($iv),
        'data' => base64_encode($ciphertext)
    ], JSON_UNESCAPED_UNICODE);
}

function decryptData($payload) {
    global $CIPHER, $KEY;
    $decoded = json_decode($payload, true);
    if (!is_array($decoded) || !isset($decoded['cipher'], $decoded['iv'], $decoded['data'])) {
        return null;
    }
    if ($decoded['cipher'] !== $CIPHER) {
        return null;
    }
    $iv = base64_decode($decoded['iv']);
    $data = base64_decode($decoded['data']);
    if ($iv === false || $data === false) {
        return null;
    }
    if ($CIPHER === 'aes-256-gcm') {
        $tag = isset($decoded['tag']) ? base64_decode($decoded['tag']) : '';
        if ($tag === false) {
            return null;
        }
        $plaintext = openssl_decrypt($data, $CIPHER, $KEY, OPENSSL_RAW_DATA, $iv, $tag);
    } else {
        $plaintext = openssl_decrypt($data, $CIPHER, $KEY, OPENSSL_RAW_DATA, $iv);
    }
    return $plaintext === false ? null : $plaintext;
}

function readStore($path, $allowUnreadable = false) {
    if (!file_exists($path)) {
        return ['records' => []];
    }
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        errorResponse('Unable to read store data.');
    }
    if (!flock($handle, LOCK_SH)) {
        fclose($handle);
        errorResponse('Unable to lock store data for reading.');
    }
    $payload = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    if ($payload === false) {
        errorResponse('Unable to read store data.');
    }
    $plaintext = decryptData($payload);
    if ($plaintext === null) {
        if ($allowUnreadable) {
            return ['records' => [], 'storeWarning' => 'unreadable'];
        }
        errorResponse('Unable to decrypt store data.');
    }
    $decoded = json_decode($plaintext, true);
    if (!is_array($decoded) || !isset($decoded['records']) || !is_array($decoded['records'])) {
        return ['records' => []];
    }
    return $decoded;
}

function writeStore($path, $storeData) {
    $json = json_encode($storeData, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        errorResponse('Failed to serialize store data.');
    }
    $encrypted = encryptData($json);
    if ($encrypted === false) {
        errorResponse('Failed to encrypt store data.');
    }
    $result = file_put_contents($path, $encrypted, LOCK_EX);
    if ($result === false) {
        errorResponse('Failed to write store data.');
    }
    @chmod($path, 0600);
    return true;
}

function generateId() {
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(16));
    }

    return uniqid('id_', true);
}

$readOnlyActions = ['list', 'get', 'export', 'clear'];
$storeData = readStore($storePath, in_array($action, $readOnlyActions, true));
$records = is_array($storeData['records']) ? $storeData['records'] : [];

switch ($action) {
    case 'list':
        respond(['records' => array_values($records)]);
        break;

    case 'get':
        $id = isset($data['id']) ? $data['id'] : null;
        if (!is_scalar($id)) {
            errorResponse('Missing record id for get action.');
        }
        foreach ($records as $record) {
            if ((string)$record['id'] === (string)$id) {
                respond(['record' => $record]);
            }
        }
        respond(['record' => null]);
        break;

    case 'put':
        $record = isset($data['record']) && is_array($data['record']) ? $data['record'] : null;
        if (!$record) {
            errorResponse('Missing record payload for put action.');
        }
        $id = isset($record['id']) && is_scalar($record['id']) ? (string)$record['id'] : generateId();
        $now = date('c');
        $new = array_replace($record, [
            'id' => $id,
            'createdAt' => isset($record['createdAt']) ? $record['createdAt'] : $now,
            'updatedAt' => $now
        ]);
        $found = false;
        foreach ($records as $index => $existing) {
            if ((string)$existing['id'] === $id) {
                $records[$index] = $new;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $records[] = $new;
        }
        writeStore($storePath, ['records' => $records]);
        respond(['record' => $new]);
        break;

    case 'update':
        $id = isset($data['id']) ? $data['id'] : null;
        $patch = isset($data['patch']) && is_array($data['patch']) ? $data['patch'] : null;
        if (!is_scalar($id) || !$patch) {
            errorResponse('Missing id or patch payload for update action.');
        }
        $updated = null;
        foreach ($records as $index => $existing) {
            if ((string)$existing['id'] === (string)$id) {
                $updated = array_merge($existing, $patch);
                $updated['id'] = $existing['id'];
                $updated['createdAt'] = isset($existing['createdAt']) ? $existing['createdAt'] : date('c');
                $updated['updatedAt'] = date('c');
                $records[$index] = $updated;
                break;
            }
        }
        if ($updated === null) {
            errorResponse('Record not found for update action.');
        }
        writeStore($storePath, ['records' => $records]);
        respond(['record' => $updated]);
        break;

    case 'remove':
        $id = isset($data['id']) ? $data['id'] : null;
        if (!is_scalar($id)) {
            errorResponse('Missing record id for remove action.');
        }
        $found = false;
        $records = array_values(array_filter($records, function ($record) use ($id, &$found) {
            if ((string)$record['id'] === (string)$id) {
                $found = true;
                return false;
            }
            return true;
        }));
        if (!$found) {
            errorResponse('Record not found for remove action.');
        }
        writeStore($storePath, ['records' => $records]);
        respond(['success' => true]);
        break;

    case 'clear':
        writeStore($storePath, ['records' => []]);
        respond(['success' => true]);
        break;

    case 'export':
        respond(['store' => ['records' => array_values($records)]]);
        break;

    default:
        errorResponse('Unhandled action.');
}
