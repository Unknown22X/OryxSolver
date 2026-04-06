Param(
  [double]$PaymentFeePct = 0.05,
  [double]$PaymentFeeFixed = 0.50,
  [double]$AiInputPer1M = 0.10,
  [double]$AiOutputPer1M = 0.40,
  [int]$FixedMonthlyUsd = 100
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function NetAfterFees([double]$gross) {
  return $gross - ($PaymentFeeFixed + ($gross * $PaymentFeePct))
}

function AiCostPerSolve([int]$inputTokens, [int]$outputTokens) {
  return (($inputTokens * $AiInputPer1M) + ($outputTokens * $AiOutputPer1M)) / 1000000.0
}

$planNet = @{
  pro = NetAfterFees 3.99
  premium = NetAfterFees 9.99
  credit50 = NetAfterFees 4.99
}

# Edit these if you want different “average” token sizes.
$avgInputTokens = 1000
$avgOutputTokens = 1000
$costPerSolve = AiCostPerSolve $avgInputTokens $avgOutputTokens

# Scenarios: tweak these knobs.
$scenarios = @(
  [pscustomobject]@{ Name = 'Small'; MAU = 1000; ProRate = 0.03; PremiumRate = 0.005; CreditBuyRate = 0.02; FreeSolves = 5; ProSolves = 40; PremiumSolves = 120 },
  [pscustomobject]@{ Name = 'Mid'; MAU = 10000; ProRate = 0.04; PremiumRate = 0.01; CreditBuyRate = 0.03; FreeSolves = 6; ProSolves = 40; PremiumSolves = 120 },
  [pscustomobject]@{ Name = 'Large'; MAU = 100000; ProRate = 0.03; PremiumRate = 0.007; CreditBuyRate = 0.02; FreeSolves = 6; ProSolves = 45; PremiumSolves = 140 }
)

Write-Host "Assumptions:"
Write-Host ("- Payment fees: {0:P0} + ${1:N2} per transaction" -f $PaymentFeePct, $PaymentFeeFixed)
Write-Host ("- AI pricing: ${0:N2} in / 1M tokens, ${1:N2} out / 1M tokens" -f $AiInputPer1M, $AiOutputPer1M)
Write-Host ("- Avg tokens per solve: {0} in, {1} out => ${2:N6} per solve" -f $avgInputTokens, $avgOutputTokens, $costPerSolve)
Write-Host ("- Fixed monthly costs placeholder: ${0:N0}" -f $FixedMonthlyUsd)
Write-Host ""

$scenarios | ForEach-Object {
  $proUsers = [math]::Round($_.MAU * $_.ProRate)
  $premiumUsers = [math]::Round($_.MAU * $_.PremiumRate)
  $freeUsers = $_.MAU - $proUsers - $premiumUsers
  if ($freeUsers -lt 0) { $freeUsers = 0 }

  $creditBuys = [math]::Round($freeUsers * $_.CreditBuyRate)

  $netRevenue =
    ($proUsers * $planNet.pro) +
    ($premiumUsers * $planNet.premium) +
    ($creditBuys * $planNet.credit50)

  $solves =
    ($freeUsers * $_.FreeSolves) +
    ($proUsers * $_.ProSolves) +
    ($premiumUsers * $_.PremiumSolves)

  $aiCost = $solves * $costPerSolve
  $profit = $netRevenue - $aiCost - $FixedMonthlyUsd

  [pscustomobject]@{
    Scenario = $_.Name
    MAU = $_.MAU
    ProUsers = $proUsers
    PremiumUsers = $premiumUsers
    CreditBuys = $creditBuys
    NetRevenueUSD = [math]::Round($netRevenue, 2)
    Solves = $solves
    AiCostUSD = [math]::Round($aiCost, 2)
    FixedUSD = $FixedMonthlyUsd
    ProfitUSD = [math]::Round($profit, 2)
  }
} | Format-Table -AutoSize

