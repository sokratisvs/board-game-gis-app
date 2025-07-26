import { Suspense, useContext, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { AuthContext } from "../../context/Auth.context";
import Sidebar from "../Sidebar/Sidebar";
// import Footer from "./Footer"

export default function Layout() {
    const { isLoggedIn } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/login');
        }
    }, [navigate, isLoggedIn])

    return (
        <div style={{ display: "flex" }}>
            <Sidebar />

            {/* Main Content */}
            <main style={{ marginLeft: "220px", width: "100%", padding: "20px" }}>
                <Suspense fallback={<div>Loading...</div>}>
                    <Outlet />
                </Suspense>
            </main>

        </div>
    )
}