import { BrowserRouter } from "react-router-dom";
import ReactDOM from 'react-dom/client'
import AppContainer from "./AppContainer";
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AppContainer />
  </BrowserRouter>,
)
