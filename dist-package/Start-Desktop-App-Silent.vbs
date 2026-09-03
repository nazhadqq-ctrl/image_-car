Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 1. Check if server on port 3002 is already responding
Function IsServerActive()
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 400, 400, 400, 400
    http.open "GET", "http://127.0.0.1:3002/api/setup-status", False
    http.send
    If Err.Number = 0 And (http.Status = 200 Or http.Status = 304) Then
        IsServerActive = True
    Else
        IsServerActive = False
    End If
    Set http = Nothing
    On Error GoTo 0
End Function

' 2. Locate node.exe binary
Function GetNodeExe()
    Dim localApp, prog86
    localApp = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
    prog86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")

    If fso.FileExists(currentDir & "\bin\node.exe") Then
        GetNodeExe = """" & currentDir & "\bin\node.exe"""
    ElseIf fso.FileExists(currentDir & "\node.exe") Then
        GetNodeExe = """" & currentDir & "\node.exe"""
    ElseIf fso.FileExists("C:\Program Files\nodejs\node.exe") Then
        GetNodeExe = """C:\Program Files\nodejs\node.exe"""
    ElseIf fso.FileExists(prog86 & "\nodejs\node.exe") Then
        GetNodeExe = """" & prog86 & "\nodejs\node.exe"""
    ElseIf fso.FileExists(localApp & "\Programs\node\node.exe") Then
        GetNodeExe = """" & localApp & "\Programs\node\node.exe"""
    Else
        GetNodeExe = "node"
    End If
End Function

' 3. Start node server silently if not already running
If Not IsServerActive() Then
    nodeExe = GetNodeExe()
    WshShell.Run nodeExe & " """ & currentDir & "\server.js""", 0, False
    For i = 1 To 30
        WScript.Sleep 250
        If IsServerActive() Then Exit For
    Next
End If

' 4. Launch dedicated maximized window in Edge / Chrome / Browser
Dim edgePath1, edgePath2, chromePath1, chromePath2
edgePath1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
edgePath2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
chromePath1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
chromePath2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")

If fso.FileExists(edgePath1) Then
    WshShell.Run """" & edgePath1 & """ --app=http://localhost:3002 --start-maximized", 1, False
ElseIf fso.FileExists(edgePath2) Then
    WshShell.Run """" & edgePath2 & """ --app=http://localhost:3002 --start-maximized", 1, False
ElseIf fso.FileExists(chromePath1) Then
    WshShell.Run """" & chromePath1 & """ --app=http://localhost:3002 --start-maximized", 1, False
ElseIf fso.FileExists(chromePath2) Then
    WshShell.Run """" & chromePath2 & """ --app=http://localhost:3002 --start-maximized", 1, False
Else
    WshShell.Run "http://localhost:3002", 1, False
End If
