Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Run Start-Desktop-App.bat / Start-App.bat with window style 0 (Completely Silent & Invisible)
batPath = currentDir & "\Start-Desktop-App.bat"
If Not fso.FileExists(batPath) Then
    batPath = currentDir & "\Start-App.bat"
End If

WshShell.Run "cmd.exe /c """"" & batPath & """""", 0, False
