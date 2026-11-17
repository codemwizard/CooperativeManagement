1. npm run verify:phase0
2. npm run test:db --workspace @symphony/db
3. .\set-env.ps1
4. npm run db:migrate:test
5. psql -U postgres -d symphony_phase1_test
6. npm run test:migrations --workspace @symphony/db
7. Restart-Service -Name postgresql*
8. 
9. 
10. node tools/bootstrap_wp1_5_database.mjs
11. winget list --id PostgreSQL.PostgreSQL.18
12. winget upgrade --id PostgreSQL.PostgreSQL.18 --silent --accept-source-agreements --accept-package-agreement
13. npm install json-canonicalize
14. npm install canonical-json
15. 
PS C:\Workspace\GitHub\Prototype> Get-ChildItem -Path "C:\Workspace\GitHub\Prototype" -Directory | ForEach-Object {
>>  $size = (Get-ChildItem -Path $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
>> [PSCustomObject]@{
>> FolderName = $_.Name
>> "Size (MB)" = [math]::Round($size / 1MB, 2)
>> }
>> } | Sort-Object "Size (MB)" -Descending
16.