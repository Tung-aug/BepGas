// Điểm khởi đầu của ứng dụng React
// StrictMode giúp phát hiện các lỗi tiềm ẩn trong quá trình phát triển
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Gắn toàn bộ ứng dụng vào thẻ <div id="root"> trong file index.html
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
