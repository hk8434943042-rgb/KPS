$body = @{
    roll_no = "1122"
    name = "Mohit Kumar"
    admission_date = "01-04-2025"
    aadhar_number = "334721374969"
    father_name = "Jitendra kumar sinha"
    mother_name = "Reena Sinha"
    class_name = "VII"
    section = "A"
    phone = "9801598020"
    status = "Active"
    date_of_birth = "12-08-2013"
} | ConvertTo-Json

try { 
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/students" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    Write-Output "✅ Student saved successfully!"
    Write-Output "Response:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch { 
    Write-Output "❌ Error: $($_.Exception.Message)"
    if ($_.Exception.Response) { 
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "Details: $($reader.ReadToEnd())"
    } 
}
