@echo off
setlocal
pushd "%~dp0"
echo Installing dependencies...
call npm install
echo.
if /I "%1"=="release" (
    echo Building and publishing MCServerList Launcher installer...
    call npm run release
) else (
    echo Building MCServerList Launcher installer...
    call npm run build
)
echo.
echo Build complete! %1
echo Check the "dist" folder for your installer. (Published builds are uploaded automatically.)
pause
popd
endlocal
