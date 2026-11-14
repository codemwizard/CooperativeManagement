$env:DATABASE_URL = 'postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony'
$env:DATABASE_SCHEMA = 'symphony'
$env:DATA_MODE = 'test'
$env:NODE_ENV = 'development'

$env:MIGRATION_TEST_DATABASE_URL = 'postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony_phase1_test'
$env:PHASE1_TEST_APP_DATABASE_URL = 'postgresql://symphony_app:symphony_dev@127.0.0.1:5432/symphony_phase1_test'
$env:PHASE1_TEST_ADMIN_DATABASE_URL = 'postgresql://postgres:khukhu16@127.0.0.1:5432/symphony_phase1_test'

Write-Host "Environment variables loaded for this PowerShell session." -ForegroundColor Green
