# Báo Cáo Nghiệm Thu & Kiểm Thử Dự Án Interdist Analytics

## 1. Tổng Quan Dự Án
**Tên dự án:** Interdist Analytics System (Báo Cáo P&G Sales Ops)
**Mô tả:** Hệ thống thu thập, xử lý và trực quan hóa dữ liệu bán hàng (Sales) chuyên sâu từ các file báo cáo Excel của nhà phân phối, dành riêng cho các dự án CRV và STMB.
**Môi trường:** Web Application (React, Vite, TypeScript, TailwindCSS)
**Cơ sở dữ liệu & Xác thực (BaaS):** Firebase (Authentication & Firestore)

---

## 2. Kiến Trúc & Công Nghệ
- **Frontend Framework:** React 18, Vite.
- **Ngôn ngữ lập trình:** TypeScript.
- **Giao diện (UI/UX):** Tailwind CSS kết hợp với components tùy chỉnh (Glassmorphism layout, Dark/Light Mode, Density tweaks).
- **Biểu đồ (Charts):** SVGs React tĩnh, thiết kế theo hướng Dashboard chuyên nghiệp.
- **Xử lý dữ liệu:** Trình phân tách và tổng hợp dữ liệu tĩnh trên Client-side thông qua Excel Parser (sử dụng thư viện XLSX).
- **Backend/Cloud Services:** Firebase Authentication (Đăng nhập Email/Password, Quản lý Roles) & Firebase Firestore (Lưu trữ Cấu hình Target, User Profiles).

---

## 3. Các Tính Năng Cốt Lõi (Nghiệm Thu)

### 3.1. Phân Quyền Hệ Thống (RBAC - Role-based Access Control)
Hệ thống được thiết lập 3 cấp độ quyền hạn (Roles):
1. **Developer (`dev`):** (Admin hệ thống - luongthevinh996@gmail.com). Toàn quyền kiểm soát hệ thống, có thể cấp quyền/hạ quyền Admin hoặc Developer cho user khác, can thiệp vào configs. Có truy cập Cổng dữ liệu.
2. **Quản trị viên (`admin`):** (admin@interdist.com.vn). Quản lý cấp tài khoản tiêu chuẩn, giới hạn trong việc thêm xóa cấp `user`, không thể thay đổi người ở vai trò `admin` hoặc `dev`. Điểu chỉnh Cấu hình Target. Có truy cập Cổng dữ liệu.
3. **Người dùng tiêu chuẩn (`user`):** Chỉ xem report trên giao diện. KHÔNG được truy cập Cổng nhập dữ liệu (Import Portal), không có quyền thay đổi Cấu hình hay quản lý người dùng. 

### 3.2. Cổng Nạp Dữ Liệu Tự Động (Data Import Portal)
- Nạp đồng thời nhiều file báo cáo Excel từ nhiều định dạng tập tin.
- Chuẩn hóa tên Cửa hàng, Ngành hàng, Mã nhân sự, tính toán các chỉ số luân chuyển (Revenue, Target, Target Full, Shifts).
- Nhận diện linh hoạt ca làm việc, KPI của từng cửa hàng theo lịch.

### 3.3. Dashboard Trực Quan Hệ (Visual Dashboard)
- **Top-Level KPIs:** Tổng Doanh Số, ACH Full Month, Weekly Growth, Daily Orders, BA Activities.
- **Dynamic Filtering:** Cho phép lọc đa chiều theo Kênh bán hàng (Channel: CRV, STMB), Vùng (Regions), và Kỳ hạn (MTD, Custom Range, Weekly, Shifts).
- **Bảng tổng hợp chi tiết (Detailed Tables):** Bảng tổng hợp theo Ngành hàng (Category), Vùng (Region), Quản lý vùng (Supervisor) với đầy đủ tiến trình tỷ lệ %.
- **Trend Charts:** Biểu đồ xu hướng so sánh Target vs Actual mỗi ngày cho cả 2 kênh dự án.

### 3.4. Chức Năng Báo Cáo & Chia Sẻ
- **Export to PDF:** Xuất báo cáo điểm bán thành định dạng PDF sạch, dễ chịu để chia sẻ cho Khách hàng P&G.
- **Export to Excel:** Xuất báo cáo Raw/Compiled thành file .xlsx để theo dõi offline.
- **Telegram Broadcast:** Tích hợp giao diện tạo tin nhắn thông báo Telegram gửi nhanh cho đội ngũ kinh doanh (Alerting System).

### 3.5. Bảng Điều Khiển Cấu Hình (Configurations)
- Quản lý cấu hình mục tiêu (Target Setting) cho Cửa hàng, Nhân viên, Ca làm việc. Dữ liệu này được lưu vĩnh viễn trên Firebase Firestore và đồng bộ cho toàn bộ hệ thống.

---

## 4. Danh Sách Kiểm Thử (Test Cases)

### Module 1: Authentication & Phân Quyền
1. [ ] Đăng nhập đúng Email/Mật khẩu thành công.
2. [ ] Tạo mới User, đảm bảo user mới chỉ ở mức "Standard".
3. [ ] Tài khoản `dev` nâng quyền một account từ `user` lên `admin` thành công.
4. [ ] Tài khoản `admin` cố gắng nâng một account khác lên `dev` -> **Hệ thống báo lỗi/chặn.**
5. [ ] Tài khoản `admin` cố gắng xóa tài khoản `dev` -> **Hệ thống báo lỗi/chặn.**
6. [ ] Tài khoản `user` không nhìn thấy nút "Cổng dữ liệu" và không thể bật popup Import File.

### Module 2: Data Import (Xử lý Excel)
7. [ ] Cổng dữ liệu phân tích đúng file Raw của CRV và STMB. Không bị khuyết dữ liệu Mã vùng (Region Fallback).
8. [ ] Hệ thống báo cáo tìm thấy và tự động tạo Profile Target cho cửa hàng mới/lạ nếu có trong file.

### Module 3: Dashboard & Báo cáo
9. [ ] Các Label, Value KPI thay đổi chuẩn xác theo bộ lọc Channel (CRV, STMB).
10. [ ] Time Range (MTD) và Custom Date filter hiển thị thay đổi chuẩn trên bảng Biểu đồ.
11. [ ] Target Tỷ lệ phần trăm tính chính xác giữa Actual và Target.

### Module 4: Tích hợp Export Export/Print
12. [ ] Giao diện xuất PDF load đầy đủ style css màu sắc.
13. [ ] Giao diện tự động copy nội dung báo cáo dạng text vào Clipboard (Nút "Copy nội dung").
14. [ ] Khởi chạy Dialog xuất Excel tải xuống file thành công không lỗi bảng mã.

---

**Kết luận:** Hệ thống đã hoàn thiện tất cả các chức năng theo yêu cầu nghiệp vụ để đưa vào giai đoạn UAT (User Acceptance Testing) tiến tới vận hành cho đội ngũ Sale.
