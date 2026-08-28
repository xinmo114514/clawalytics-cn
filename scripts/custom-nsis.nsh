; Custom NSIS script for Clawalytics installer

!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER

; electron-builder already restores the install mode and installation folder
; from its registry entries. Keep a separate runtime flag so a manually
; downloaded installer can clearly tell the user that this is an update too.
Var ClawalyticsInstallKind
Var ClawalyticsPreviousInstallDir
Var ClawalyticsPreviousVersion

!macro customInit
  StrCpy $ClawalyticsInstallKind "fresh"
  StrCpy $ClawalyticsPreviousInstallDir ""
  StrCpy $ClawalyticsPreviousVersion ""

  ReadRegStr $ClawalyticsPreviousInstallDir SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $ClawalyticsPreviousInstallDir != ""
    ${if} ${FileExists} "$ClawalyticsPreviousInstallDir\${APP_EXECUTABLE_FILENAME}"
      StrCpy $ClawalyticsInstallKind "update"
      ReadRegStr $ClawalyticsPreviousVersion SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    ${endif}
  ${endif}
!macroend

; Show an update notice for a normal, manually launched installer. Automatic
; updates already pass /updated and should remain silent/one-step.
!macro customWelcomePage
  !insertmacro MUI_PAGE_INIT
  PageEx custom
    PageCallbacks ClawalyticsUpdatePagePre ClawalyticsUpdatePageLeave
  PageExEnd

  Function ClawalyticsUpdatePagePre
    ${if} $ClawalyticsInstallKind != "update"
    ${orIf} ${isUpdated}
      Abort
    ${endIf}

    !insertmacro MUI_HEADER_TEXT "更新 Clawalytics" "保留现有配置和数据"
    nsDialogs::Create 1018
    Pop $0
    ${if} $0 == error
      Abort
    ${endIf}

    ${if} $ClawalyticsPreviousVersion != ""
      StrCpy $1 "已检测到 Clawalytics v$ClawalyticsPreviousVersion。"
    ${else}
      StrCpy $1 "已检测到现有的 Clawalytics 安装。"
    ${endIf}
    ${NSD_CreateLabel} 0u 0u 300u 30u "$1$\r$\n将更新到 v${VERSION}。"
    Pop $2
    ${NSD_CreateLabel} 0u 45u 300u 45u "安装程序将使用原安装目录，并保留配置、数据库和用户数据。"
    Pop $3
    nsDialogs::Show
  FunctionEnd

  Function ClawalyticsUpdatePageLeave
  FunctionEnd
!macroend

!endif

; Use NSIS' built-in file embedding instead of electron-builder's 7z
; extract-and-copy path. The NSIS staging directory stores the main executable
; with a neutral suffix, then finalizes it after extraction. This avoids
; Windows security tooling rejecting writes to the final exe path while
; reporting the misleading "app cannot be closed" message.
; The build hook generates custom-nsis.generated.nsh next to this file with
; APP_BUILD_DIR set to the actual staging directory for the current build.

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
