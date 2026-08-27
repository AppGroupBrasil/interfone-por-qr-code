<#
  Registra (ou atualiza) a tarefa diaria que puxa o banco do servidor para o
  OneDrive. Rodar uma vez, na maquina que guarda a chave SSH:

      powershell -File scripts\backup-db-agendar.ps1

  Conferir:  Get-ScheduledTask "AppInterfone - Backup do banco"
  Rodar ja:  Start-ScheduledTask "AppInterfone - Backup do banco"
  Remover:   Unregister-ScheduledTask "AppInterfone - Backup do banco"
#>
param(
  [string]$Nome = "AppInterfone - Backup do banco",
  [string]$Hora = "12:00"
)

$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "backup-db-offsite.ps1"
if (-not (Test-Path $script)) { throw "Nao achei $script" }

$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -File `"$script`""

$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora

# StartWhenAvailable: se o PC estava desligado na hora marcada, a copia sai
# assim que ele liga - sem isso o dia inteiro ficaria sem backup fora do host.
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $Nome -Action $acao -Trigger $gatilho `
  -Settings $config -Force `
  -Description "Copia o data.db do Hetzner para o OneDrive (retencao de 7 dias)." | Out-Null

Get-ScheduledTask -TaskName $Nome | Select-Object TaskName, State
