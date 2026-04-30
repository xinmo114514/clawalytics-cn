; Custom NSIS script for Clawalytics installer
; Features:
; 1. Silently close the running app before uninstall/extract steps

!ifmacrondef customCheckAppRunning
  !define customCheckAppRunning
  !macro customCheckAppRunning
    DetailPrint `Closing running "${PRODUCT_NAME}" before installation...`
    !ifdef INSTALL_MODE_PER_ALL_USERS
      nsExec::ExecToLog `"$SYSDIR\cmd.exe" /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /t /f`
    !else
      nsExec::ExecToLog `"$SYSDIR\cmd.exe" /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /t /f /fi "USERNAME eq %USERNAME%"`
    !endif
    Pop $0
    Sleep 1000
  !macroend
!endif
