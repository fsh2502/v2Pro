<?php

// Isolated tests: load dependencies without booting the site's providers or real database.
$autoload = getenv('V2PRO_TEST_AUTOLOAD') ?: __DIR__ . '/../vendor/autoload.php';
$loader = require $autoload;
$root = dirname(__DIR__);
$map = [];
foreach ($loader->getClassMap() as $class => $path) {
    foreach (['App\\' => '/app/', 'Tests\\' => '/tests/', 'Library\\' => '/library/'] as $prefix => $directory) {
        if (strpos($class, $prefix) !== 0) continue;
        $local = $root . $directory . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($local)) $map[$class] = $local;
    }
}
$loader->addClassMap($map);
$loader->addPsr4('App\\', $root . '/app', true);
$loader->addPsr4('Tests\\', $root . '/tests', true);
$loader->addPsr4('Library\\', $root . '/library', true);
