import axios, { type AxiosInstance } from 'axios'

// `??` only catches undefined/null, so an empty VITE_API_URL would win and
// break every request. Treat blank as unset.
const baseURL = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3000/api/v1'

const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  // withCredentials is deliberately NOT set here. The refresh cookie's Path
  // restricts it to the auth routes, so sending credentials with /todos buys
  // nothing; the four auth calls opt in individually (see api/authApi.ts).
})

export default axiosInstance
