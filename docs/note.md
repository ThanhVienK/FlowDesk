while ($true) {
    curl.exe -X POST "http://localhost:3001/cron/schedules" `
             -H "Authorization: Bearer YOUR_CRON_SECRET"
    Start-Sleep -Seconds 60
}

