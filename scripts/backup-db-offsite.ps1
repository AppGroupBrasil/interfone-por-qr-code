<#
  Backup do banco do App Interfone para FORA do servidor.

  O app ja mantem backup interno a cada 6h (28 copias, ~7 dias) no volume
  appinterfone_backups - mas tudo no mesmo Hetzner. Este script tira uma copia
  fresca e a guarda no OneDrive, que sincroniza para a nuvem: e o unico
  backup que sobrevive a perda do servidor.

  Roda pela tarefa agendada "AppInterfone - Backup do banco" (ver
  scripts/backup-db-agendar.ps1). Manual: powershell -File scripts\backup-db-offsite.ps1
#>
param(
  [string]$Destino = "$env:USERPROFILE\OneDrive\Backups\AppInterfone",
  [string]$SshHost = "simples-manutencao-hetzner",
  [int]$RetencaoDias = 7
)

$ErrorActionPreference = "Stop"

$remotoDb  = "/mnt/docker-data/docker/volumes/appinterfone_appinterfone_data/_data/data.db"
$remotoTmp = "/tmp/appinterfone-offsite.db"
$carimbo   = Get-Date -Format "yyyyMMdd-HHmm"
$arquivo   = Join-Path $Destino "appinterfone-data-$carimbo.db.gz"
$log       = Join-Path $Destino "backup.log"

if (-not (Test-Path $Destino)) { New-Item -ItemType Directory -Path $Destino -Force | Out-Null }

function Registrar($texto) {
  "$(Get-Date -Format s) $texto" | Add-Content -Path $log -Encoding utf8
}

try {
  # .backup usa a API online do SQLite: copia consistente com o container
  # escrevendo. O integrity_check roda no proprio servidor - nao adianta
  # transferir arquivo corrompido para so descobrir depois.
  $cmd = "sqlite3 $remotoDb '.backup $remotoTmp' && sqlite3 $remotoTmp 'PRAGMA integrity_check;' && gzip -f $remotoTmp"
  $saida = ssh $SshHost $cmd
  if ($LASTEXITCODE -ne 0) { throw "Comando remoto falhou (exit $LASTEXITCODE): $saida" }
  $veredito = ($saida | Select-Object -First 1)
  if ("$veredito".Trim() -ne "ok") { throw "integrity_check devolveu: $saida" }

  scp -q "${SshHost}:${remotoTmp}.gz" $arquivo
  if ($LASTEXITCODE -ne 0) { throw "Transferencia falhou (exit $LASTEXITCODE)." }
  ssh $SshHost "rm -f ${remotoTmp}.gz" | Out-Null

  $tamanho = (Get-Item $arquivo).Length
  if ($tamanho -lt 10KB) { throw "Arquivo baixado tem $tamanho bytes - suspeito." }

  # Retencao so depois que a copia de hoje chegou inteira: uma falha nunca
  # pode deixar o destino vazio.
  Get-ChildItem $Destino -Filter "appinterfone-data-*.db.gz" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetencaoDias) } |
    Remove-Item -Force

  Registrar "OK $([System.IO.Path]::GetFileName($arquivo)) ($([math]::Round($tamanho/1KB,1)) KB)"
} catch {
  Registrar "FALHA $($_.Exception.Message)"
  throw
}
