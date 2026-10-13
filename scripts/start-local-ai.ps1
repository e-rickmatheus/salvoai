$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$binaryPath = Join-Path $projectPath 'data/runtime/ollama/ollama.exe'
if (-not (Test-Path -LiteralPath $binaryPath)) { throw 'Ollama portátil ausente. Consulte docs/umsalve/README.md.' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $projectPath 'data/models/ollama'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_NO_CLOUD = '1'
try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 }
catch { Start-Process -FilePath $binaryPath -ArgumentList 'serve' -WindowStyle Hidden -WorkingDirectory $projectPath -RedirectStandardOutput (Join-Path $projectPath 'data/runtime/ollama.log') -RedirectStandardError (Join-Path $projectPath 'data/runtime/ollama-error.log'); Start-Sleep -Seconds 3 }
& $binaryPath pull gemma3:1b
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível baixar o modelo local.' }
& $binaryPath pull embeddinggemma
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível baixar o modelo de busca por significado.' }
& $binaryPath pull qwen2.5:3b
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível baixar o modelo do chat.' }
Write-Output 'IA local pronta: Gemma 3 1B, Qwen 2.5 3B e EmbeddingGemma em http://127.0.0.1:11434. Modelos guardados no projeto.'
