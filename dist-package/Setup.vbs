' 🚗 تۆماری تاقیگەکان - Standalone Desktop Installer (VBS)
Option Explicit

Dim fso, wshShell, currentDir, localAppData, installDir, desktopPath, programsPath
Dim targetVbs, iconPath, shortcut, menuShortcut

Set fso = CreateObject("Scripting.FileSystemObject")
Set wshShell = CreateObject("WScript.Shell")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
localAppData = wshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
installDir = localAppData & "\CarManagementSystem"

If Not fso.FolderExists(installDir) Then
    fso.CreateFolder(installDir)
End If

wshShell.Run "robocopy """ & currentDir & """ """ & installDir & """ /E /IS /IT /NFL /NDL /NJH /NJS /nc /ns /np", 0, True

targetVbs = installDir & "\Start-App-Silent.vbs"
iconPath = installDir & "\app.ico"
desktopPath = wshShell.SpecialFolders("Desktop")
programsPath = wshShell.SpecialFolders("Programs")

Set shortcut = wshShell.CreateShortcut(desktopPath & "\تۆماری تاقیگەکان.lnk")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & targetVbs & """"
shortcut.WorkingDirectory = installDir
shortcut.IconLocation = iconPath & ",0"
shortcut.Description = "تۆماری تاقیگەکان — دیزاین و پرۆگرامسازی: NAZHAD Q. MAHAMMED"
shortcut.Save

Set menuShortcut = wshShell.CreateShortcut(programsPath & "\تۆماری تاقیگەکان.lnk")
menuShortcut.TargetPath = "wscript.exe"
menuShortcut.Arguments = """" & targetVbs & """"
menuShortcut.WorkingDirectory = installDir
menuShortcut.IconLocation = iconPath & ",0"
menuShortcut.Description = "تۆماری تاقیگەکان — دیزاین و پرۆگرامسازی: NAZHAD Q. MAHAMMED"
menuShortcut.Save

wshShell.CurrentDirectory = installDir
wshShell.Run """" & targetVbs & """", 0, False

MsgBox "✅ بە سەرکەوتوویی دامەزرا!" & vbCrLf & vbCrLf & _
       "ئایکۆنی پرۆگرامەکە بەناوی (تۆماری تاقیگەکان) خرایە سەر ڕووی شاشە (Desktop) و لیستی پرۆگرامەکان." & vbCrLf & _
       "دیزاین و پرۆگرامسازی: NAZHAD Q. MAHAMMED" & vbCrLf & _
       "پرۆگرامەکە ئێستا کرایەوە.", vbInformation, "تۆماری تاقیگەکان"
