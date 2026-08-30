<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('UTC');

$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif'
];
$maxSize = 5 * 1024 * 1024;
$uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads';

function respond($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function failUpload($message, $status = 400) {
    respond(['error' => $message], $status);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    failUpload('Only POST requests are allowed.', 405);
}

$contentType = isset($_SERVER['CONTENT_TYPE'])
    ? $_SERVER['CONTENT_TYPE']
    : (isset($_SERVER['HTTP_CONTENT_TYPE']) ? $_SERVER['HTTP_CONTENT_TYPE'] : '');
if (stripos($contentType, 'multipart/form-data') !== 0) {
    failUpload('Uploads must use multipart/form-data.');
}

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    failUpload('Unable to initialize upload directory.', 500);
}

$action = isset($_POST['action']) ? $_POST['action'] : 'upload';

function safeBasename($name) {
    return preg_replace('/[^a-zA-Z0-9._-]/', '', basename((string)$name));
}

if ($action === 'delete') {
    $filename = safeBasename(isset($_POST['filename']) ? $_POST['filename'] : '');
    if ($filename === '') {
        failUpload('Missing filename.');
    }
    $path = realpath($GLOBALS['uploadDir'] . DIRECTORY_SEPARATOR . $filename);
    $root = realpath($GLOBALS['uploadDir']);
    if ($path === false || $root === false || strpos($path, $root) !== 0 || !is_file($path)) {
        respond(['success' => true]);
    }
    @unlink($path);
    respond(['success' => true]);
}

if ($action !== 'upload') {
    failUpload('Unknown upload action.');
}

if (!isset($_FILES['media']) || !is_array($_FILES['media'])) {
    failUpload('Missing media file.');
}

$file = $_FILES['media'];
if (!isset($file['error']) || is_array($file['error'])) {
    failUpload('Invalid upload payload.');
}
if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
    failUpload('File is too large.');
}
if ($file['error'] !== UPLOAD_ERR_OK) {
    failUpload('Upload failed.');
}
if (!isset($file['size']) || $file['size'] <= 0 || $file['size'] > $maxSize) {
    failUpload('File is too large.');
}
if (!is_uploaded_file($file['tmp_name'])) {
    failUpload('Invalid uploaded file.');
}

$mime = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
    }
}
if (!$mime && function_exists('mime_content_type')) {
    $mime = mime_content_type($file['tmp_name']);
}
$imageInfo = @getimagesize($file['tmp_name']);
if (!$mime && $imageInfo !== false && isset($imageInfo['mime'])) {
    $mime = $imageInfo['mime'];
}
if (!isset($allowedTypes[$mime])) {
    failUpload('Unsupported file type.');
}

if ($imageInfo === false || !isset($imageInfo['mime']) || $imageInfo['mime'] !== $mime) {
    failUpload('Uploaded file is not a valid image.');
}

$original = isset($file['name']) ? basename($file['name']) : 'upload';
$extension = $allowedTypes[$mime];
$bytes = function_exists('random_bytes') ? bin2hex(random_bytes(12)) : preg_replace('/[^a-zA-Z0-9]/', '', uniqid('', true));
$filename = date('YmdHis') . '-' . $bytes . '.' . $extension;
$destination = $uploadDir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    failUpload('Unable to store uploaded file.', 500);
}

@chmod($destination, 0644);

respond([
    'media' => [
        'filename' => $filename,
        'originalName' => $original,
        'mimeType' => $mime,
        'size' => (int)$file['size'],
        'url' => './uploads/' . $filename
    ]
]);
