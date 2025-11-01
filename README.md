# Go-Electrify Simulators

Ứng dụng mô phỏng trạm sạc điện cho xe điện Go-Electrify, bao gồm giao diện web và server backend.

## 🏗️ Cấu trúc dự án

```
go-electrify-simulators/
├── apps/
│   ├── client/          # Giao diện web (React + Vite)
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   └── hooks/       # React hooks
│   │   └── public/          # Static assets
│   └── server/          # Server backend (Node.js + TypeScript)
│       ├── src/
│       │   ├── AblyCore.ts          # Kết nối Ably cho handshake
│       │   ├── ablyIntegration.ts   # Tích hợp Ably real-time
│       │   ├── chargingSimulation.ts # Logic mô phỏng sạc
│       │   ├── server.ts            # HTTP server
│       │   ├── socketHandlers.ts    # WebSocket handlers
│       │   ├── state.ts             # Quản lý state
│       │   └── types.ts             # TypeScript types
│       └── .env.example             # Template cấu hình
├── packages/
│   ├── eslint-config/   # ESLint configuration
│   └── typescript-config/ # TypeScript configuration
└── turbo.json           # Turborepo configuration
```

## 🚀 Cách chạy ứng dụng

### Yêu cầu hệ thống

- Node.js (phiên bản 18+)
- pnpm (package manager)

### 1. Cài đặt dependencies

```bash
pnpm install
```

### 2. Cấu hình môi trường

```bash
cd apps/server
cp .env.example .env
# Chỉnh sửa file .env với thông tin thực tế của bạn
```

**Các biến cần thiết trong `.env`:**

- `PORT=3001` - Port cho server
- `BACKEND_URL` - URL của backend API
- `DOCK_ID` - ID của trạm sạc
- `DOCK_SECRET` - Secret key của trạm sạc

### 3. Chạy ứng dụng

```bash
# Chạy cả client và server
pnpm run dev

# Hoặc chạy riêng từng phần:
pnpm run dev:client    # Chỉ chạy giao diện web
pnpm run dev:server    # Chỉ chạy server backend
```

### 4. Truy cập ứng dụng

- **Giao diện web**: `http://localhost:5173`
- **Server API**: `http://localhost:3001`

## 🔧 Công nghệ sử dụng

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Real-time**: Ably (WebSocket messaging)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Build Tool**: Turborepo (monorepo management)
- **Package Manager**: pnpm

## 📋 Tính năng chính

- ✅ Mô phỏng quá trình sạc xe điện
- ✅ Giao tiếp real-time với backend qua Ably
- ✅ WebSocket connection cho client
- ✅ RESTful API endpoints
- ✅ Comprehensive error logging
- ✅ Environment-based configuration

## 🐛 Troubleshooting

### Lỗi kết nối backend

- Kiểm tra `BACKEND_URL` trong file `.env`
- Đảm bảo backend server đang chạy
- Kiểm tra firewall và network connectivity

### Lỗi Ably connection

- Verify Ably tokens được trả về từ handshake API
- Kiểm tra Ably channel permissions
- Đảm bảo `handshakeResponse` có dữ liệu hợp lệ

### Port conflicts

```bash
# Kiểm tra port đang sử dụng
lsof -i :3001
lsof -i :5173

# Kill process nếu cần
kill -9 <PID>
```

## 📝 Development Notes

- Sử dụng function declarations thay vì const expressions
- Fetch API thay vì axios cho HTTP requests
- Comprehensive error logging cho debugging
- Environment variables được quản lý qua `.env` files

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Tạo Pull Request

## 📄 License

This project is private and proprietary to Go-Electrify.
