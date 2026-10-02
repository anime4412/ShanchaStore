' ============================================================
'   ShanChaStore - khoidong.vbs
'   BẤM ĐÚP FILE NÀY (hoặc shortcut trên Desktop):
'   1) Kiểm tra server http://localhost:3000 đã chạy chưa.
'   2) Chưa chạy -> tự khởi động node server.js ẨN (không
'      hiện cửa sổ terminal đen).
'   3) Mở trình duyệt tại http://localhost:3000.
'   KHÔNG cần mở terminal, không cần gõ lệnh gì.
' ============================================================
Option Explicit
Dim shell, http, running, i, projDir

Set shell = CreateObject("WScript.Shell")
Set http = CreateObject("MSXML2.XMLHTTP")
projDir = "C:\Users\LEGION R7000\Documents\ASM\ShanchaStore"
shell.CurrentDirectory = projDir

' --- Hàm kiểm tra server đang chạy chưa ---
Function ServerUp()
  Dim ok
  ok = False
  On Error Resume Next
  http.open "GET", "http://localhost:3000/api/bootstrap", False
  http.send
  If Err.Number = 0 And http.Status = 200 Then ok = True
  On Error GoTo 0
  ServerUp = ok
End Function

running = ServerUp()

' --- Chưa chạy thì khởi động server ẩn ---
If Not running Then
  ' 0 = cửa sổ ẩn hoàn toàn; False = không chờ
  shell.Run "cmd /c node server.js", 0, False
  ' Chờ tối đa ~15 giây cho server lên
  For i = 1 To 30
    WScript.Sleep 500
    If ServerUp() Then Exit For
  Next
End If

' --- Mở trang web ---
shell.Run "http://localhost:3000", 1, False
