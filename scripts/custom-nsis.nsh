; Custom NSIS script for Clawalytics installer

; Use NSIS' built-in file embedding instead of electron-builder's 7z
; extract-and-copy path. The NSIS staging directory stores the main executable
; with a neutral suffix, then finalizes it after extraction. This avoids
; Windows security tooling rejecting writes to the final exe path while
; reporting the misleading "app cannot be closed" message.
!define APP_BUILD_DIR "${__FILEDIR__}\..\release\win-unpacked-nsis"

!macro customInstall
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}.payload" 0 ClawalyticsMissingExePayload
  Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ClearErrors
  Rename "$INSTDIR\${APP_EXECUTABLE_FILENAME}.payload" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  IfErrors 0 ClawalyticsExePayloadDone
    MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to finalize ${APP_EXECUTABLE_FILENAME}."
    Quit
  ClawalyticsExePayloadDone:

  Goto ClawalyticsPayloadDone

  ClawalyticsMissingExePayload:
    MessageBox MB_OK|MB_ICONEXCLAMATION "Installer payload is missing ${APP_EXECUTABLE_FILENAME}."
    Quit

  ClawalyticsPayloadDone:
!macroend
