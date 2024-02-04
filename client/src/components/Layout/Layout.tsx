import { Suspense, useContext, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { AuthContext } from "../../context/Auth.context";
// import Header from "./Header"
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
        <>
            {/* <Header /> */}
            <main>
            <Suspense fallback={<div>Loading...</div>}>                
                <Outlet />
            </Suspense>
            </main>
            {/* <Footer /> */}
        </>
    )
}