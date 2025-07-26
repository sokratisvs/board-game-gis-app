import { useState } from "react";
import { Link } from "react-router-dom";
import PathConstants from '../../routes/pathConstants'
import "./Sidebar.css"; // Import CSS for styling

const menuItems = [
    { label: "Map View", path: PathConstants.MAIN },
    // { label: "Statistics", action: onToggleStats },
    { label: "Users", path: PathConstants.USERS },
    // { label: "Activity", action: () => {} },
    { label: "Settings", path: PathConstants.SETTINGS },
];

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(true);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
            <button className="toggle-btn" onClick={toggleSidebar}>
                ☰
            </button>

            <div className="menu">
                {menuItems.map((item) => (
                    <li className="menu-item" key={item.label}>
                        <Link to={item.path}>{item.label}</Link>
                    </li>
                ))}
            </div>
        </div>
    );
};

export default Sidebar;
