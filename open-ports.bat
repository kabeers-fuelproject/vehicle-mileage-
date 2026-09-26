@echo off
netsh advfirewall firewall add rule name="VehicleAutomation-Vite-5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="VehicleAutomation-Flask-5000" dir=in action=allow protocol=TCP localport=5000
echo.
echo Done. Ports 5173 and 5000 are now open on private networks.
pause
