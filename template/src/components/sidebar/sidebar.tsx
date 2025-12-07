import { useAppDispatch, useAppSelector } from "../../core/redux/store";
import { updateTheme } from "../../core/redux/themeSlice";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { setExpandMenu, setMobileSidebar, setHiddenLayout } from "../../core/redux/sidebarSlice";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { SidebarData } from "./sidebarData";
import { all_routes } from "../../routes/all_routes";
import ImageWithBasePath from "../image-with-base-path";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SidebarMenuItem {
  label: string;
  link: string;
  submenu?: boolean;
  icon?: string;
  submenuItems?: SidebarMenuItem[];
  relatedRoutes?: string[];
  count?: number;
  isThemeSettings?: boolean;
}

interface SidebarSection {
  tittle: string;
  adminOnly?: boolean;
  submenuItems: SidebarMenuItem[];
}

// ============================================
// LEADDASH ADMIN ROLE CONFIGURATION
// ============================================

// Admin roles from LeadDash that can access Admin section
const ADMIN_ROLES = ['Agency Admin', 'Agency Owner'];
const ADMIN_TYPES = ['AGENCY-ADMIN', 'AGENCY-OWNER'];

// ============================================
// GET CURRENT USER FROM LEADDASH
// ============================================

const getCurrentUser = (): any | null => {
  try {
    // Check for current user stored after LeadDash login
    const possibleKeys = ['currentUser', 'user', 'loggedInUser', 'authUser', 'leaddashUser'];
    
    for (const key of possibleKeys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.id || parsed.email)) {
          return parsed;
        }
      }
    }
    
    // Fallback: Check if user info is in location data (for testing)
    const locationData = localStorage.getItem('location');
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    
    if (locationData && (userId || userEmail)) {
      const locations = JSON.parse(locationData);
      for (const locationId of Object.keys(locations)) {
        const location = locations[locationId];
        if (location.users && Array.isArray(location.users)) {
          const foundUser = location.users.find((u: any) => 
            u.id === userId || u.email === userEmail
          );
          if (foundUser) {
            return foundUser;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// ============================================
// CHECK IF USER HAS ADMIN ROLE
// ============================================

const checkUserIsAdmin = (): boolean => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return false;
    }
    
    // Check role field (e.g., "Agency Admin", "Agency Owner")
    if (currentUser.role && ADMIN_ROLES.includes(currentUser.role)) {
      return true;
    }
    
    // Check type field (e.g., "AGENCY-ADMIN", "AGENCY-OWNER")
    if (currentUser.type && ADMIN_TYPES.includes(currentUser.type)) {
      return true;
    }
    
    // Check userType field (alternative)
    if (currentUser.userType && ADMIN_TYPES.includes(currentUser.userType)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user admin status:', error);
    return false;
  }
};

// ============================================
// SIDEBAR COMPONENT
// ============================================

const Sidebar = () => {
  const route = all_routes;
  const Location = useLocation();
  const pathname = Location.pathname;
  const [subsidebar, setSubsidebar] = useState("");
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const dispatch = useAppDispatch();

  // ============================================
  // USER ROLE CHECK
  // ============================================
  
  const isUserAdmin = useMemo(() => {
    return checkUserIsAdmin();
  }, []);

  // Filter sidebar data based on user role
  const filteredSidebarData = useMemo(() => {
    return (SidebarData as SidebarSection[]).filter(section => {
      // If section is admin only, check if user has admin role
      if (section.adminOnly) {
        return isUserAdmin;
      }
      return true;
    });
  }, [isUserAdmin]);

  // ============================================
  // MENU ACTIVE STATE LOGIC
  // ============================================

  const isMenuItemActive = useCallback((item: SidebarMenuItem, pathname: string): boolean => {
    if (item.link && item.link !== "#" && !item.link.startsWith("#") && item.link === pathname) return true;
    if (item.relatedRoutes && item.relatedRoutes.includes(pathname)) return true;
    if (item.submenuItems && item.submenuItems.length > 0) {
      return item.submenuItems.some((child) => isMenuItemActive(child, pathname));
    }
    return false;
  }, []);

  // On mount or pathname change, auto-open submenus with an active link
  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {};
    filteredSidebarData.forEach((mainLabel) => {
      mainLabel.submenuItems?.forEach((title: SidebarMenuItem) => {
        if (isMenuItemActive(title, pathname)) {
          newOpenMenus[title.label] = true;
        }
      });
    });
    setOpenMenus(newOpenMenus);
  }, [pathname, isMenuItemActive, filteredSidebarData]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleMenuToggle = useCallback((label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const toggleSubsidebar = useCallback((subitem: any) => {
    setSubsidebar((prev) => (subitem === prev ? "" : subitem));
  }, []);

  const handleClick = useCallback((label: any) => {
    handleMenuToggle(label);
  }, [handleMenuToggle]);

  // Handle opening theme settings offcanvas
  const handleOpenThemeSettings = useCallback(() => {
    const offcanvasElement = document.getElementById('theme-settings-offcanvas');
    if (offcanvasElement) {
      const bootstrap = (window as any).bootstrap;
      if (bootstrap && bootstrap.Offcanvas) {
        const offcanvas = new bootstrap.Offcanvas(offcanvasElement);
        offcanvas.show();
      } else {
        offcanvasElement.classList.add('show');
        offcanvasElement.style.visibility = 'visible';
        document.body.classList.add('offcanvas-backdrop');
      }
    }
  }, []);

  const navigate = useNavigate();
  const themeSettings = useAppSelector((state) => state.theme.themeSettings);

  const handleMiniSidebar = useCallback(() => {
    if (themeSettings["data-layout"] === "hidden") {
      dispatch(setHiddenLayout(false));
      return;
    }
    
    const rootElement = document.documentElement;
    const isMini = rootElement.getAttribute("data-layout") === "mini";
    const updatedLayout = isMini ? "default" : "mini";
    dispatch(
      updateTheme({
        "data-layout": updatedLayout,
      })
    );
    if (isMini) {
      rootElement.classList.remove("mini-sidebar");
    } else {
      rootElement.classList.add("mini-sidebar");
    }
  }, [dispatch, themeSettings]);

  const onMouseEnter = useCallback(() => {
    dispatch(setExpandMenu(true));
  }, [dispatch]);

  const onMouseLeave = useCallback(() => {
    dispatch(setExpandMenu(false));
  }, [dispatch]);

  const handleLayoutClick = useCallback((layout: string) => {
    const layoutSettings: any = {
      "data-layout": "default",
      dir: "ltr",
    };
    switch (layout) {
      case "Default":
        layoutSettings["data-layout"] = "default";
        break;
      case "Hidden":
        layoutSettings["data-layout"] = "hidden";
        dispatch(setHiddenLayout(true));
        break;
      case "Mini":
        layoutSettings["data-layout"] = "mini";
        break;
      case "Hover View":
        layoutSettings["data-layout"] = "hoverview";
        break;
      case "Full Width":
        layoutSettings["data-layout"] = "full-width";
        break;
      case "Dark":
        layoutSettings["data-bs-theme"] = "dark";
        break;
      case "RTL":
        layoutSettings.dir = "rtl";
        break;
      default:
        break;
    }
    dispatch(updateTheme(layoutSettings));
    navigate("/dashboard");
  }, [dispatch, navigate]);

  const mobileSidebar = useAppSelector((state) => state.sidebarSlice.mobileSidebar);
  const toggleMobileSidebar = useCallback(() => {
    dispatch(setMobileSidebar(!mobileSidebar));
  }, [dispatch, mobileSidebar]);

  useEffect(() => {
    const rootElement: any = document.documentElement;
    Object.entries(themeSettings).forEach(([key, value]) => {
      rootElement.setAttribute(key, value);
    });
    
    if (themeSettings["data-layout"] === "hidden") {
      rootElement.classList.remove("mini-sidebar");
    } else if (themeSettings["data-layout"] === "mini") {
      rootElement.classList.add("mini-sidebar");
    } else {
      rootElement.classList.remove("mini-sidebar");
    }
  }, [
    themeSettings["data-bs-theme"],
    themeSettings["dir"],
    themeSettings["data-layout"],
    themeSettings["data-sidebar"],
    themeSettings["data-color"],
    themeSettings["data-topbar"],
    themeSettings["data-size"],
    themeSettings["data-width"],
    themeSettings["data-sidebarbg"]
  ]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Sidenav Menu Start */}
      <div
        className="sidebar"
        id="sidebar"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        tabIndex={-1}
      >
        {/* Start Logo */}
        <div className="sidebar-logo">
          <div>
            <Link to={route.dashboard} className="logo logo-normal">
              <ImageWithBasePath src="assets/img/logo.svg" alt="Logo" />
            </Link>
            <Link to={route.dashboard} className="logo-small">
              <ImageWithBasePath src="assets/img/logo-small.svg" alt="Logo" />
            </Link>
            <Link to={route.dashboard} className="dark-logo">
              <ImageWithBasePath src="assets/img/logo-dark.svg" alt="Logo" />
            </Link>
          </div>
          <button
            className="sidenav-toggle-btn btn border-0 p-0 active"
            id="toggle_btn"
            onClick={handleMiniSidebar}
            type="button"
          >
            <i className="ti ti-arrow-bar-to-left" />
          </button>
          <button className="sidebar-close" onClick={toggleMobileSidebar} type="button">
            <i className="ti ti-x align-middle" />
          </button>
        </div>
        {/* End Logo */}

        {/* Sidenav Menu */}
        <div className="sidebar-inner" data-simplebar="">
          <OverlayScrollbarsComponent style={{ height: "100%", width: "100%" }}>
            <div id="sidebar-menu" className="sidebar-menu">
              <ul>
                {filteredSidebarData?.map((mainLabel, index) => (
                  <React.Fragment key={`main-${index}`}>
                    {mainLabel?.tittle && (
                      <li className="menu-title">
                        <span>{mainLabel.tittle}</span>
                      </li>
                    )}
                    {(mainLabel?.submenuItems as SidebarMenuItem[])?.map((title, i) => {
                      const isActive = isMenuItemActive(title, Location.pathname);
                      const isMenuOpen = openMenus[title.label] || false;
                      const isThemeSettingsItem = (title as any).isThemeSettings === true;
                      
                      return (
                        <li className="submenu" key={`title-${i}`}>
                          {isThemeSettingsItem ? (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenThemeSettings();
                              }}
                              className=""
                              tabIndex={0}
                              style={{ fontSize: '15px', cursor: 'pointer' }}
                            >
                              <i className={`ti ti-${title.icon}`}></i>
                              <span>{title?.label}</span>
                            </a>
                          ) : (
                            <Link
                              to={title?.submenu ? "#" : title?.link}
                              onClick={() => {
                                handleClick(title?.label);
                                if (mainLabel?.tittle === "Layout") {
                                  handleLayoutClick(title?.label);
                                }
                              }}
                              className={`${isActive ? "active" : ""} ${isMenuOpen ? "subdrop" : ""}`}
                              tabIndex={0}
                              style={{ fontSize: '15px' }}
                            >
                              <i className={`ti ti-${title.icon}`}></i>
                              <span>{title?.label}</span>
                              {title.label === "Changelog" && (
                                <span className="badge badge-sm bg-success" style={{ marginLeft: 8 }}>v1.0</span>
                              )}
                              {title?.count && (
                                <span className="count">{title.count}</span>
                              )}
                              {title?.submenu && (
                                <span className="menu-arrow"></span>
                              )}
                            </Link>
                          )}
                          {title?.submenu && (
                            <ul style={{ display: isMenuOpen ? "block" : "none" }}>
                              {(title?.submenuItems as SidebarMenuItem[])?.map((item, j) => {
                                const isSubActive = isMenuItemActive(item, Location.pathname);
                                
                                return (
                                  <li
                                    className={`${item?.submenuItems ? "submenu submenu-two" : ""} `}
                                    key={`item-${j}`}
                                  >
                                    <Link
                                      to={item?.submenu ? "#" : item?.link}
                                      className={`${isSubActive ? "active subdrop" : ""} ${subsidebar === item?.label ? "subdrop" : ""}`}
                                      onClick={() => {
                                        toggleSubsidebar(item?.label);
                                        if (title?.label === "Layouts") {
                                          handleLayoutClick(item?.label);
                                        }
                                      }}
                                      tabIndex={0}
                                    >
                                      {item?.label}
                                      {item?.submenu && (
                                        <span className="menu-arrow custome-menu"></span>
                                      )}
                                    </Link>
                                    {item?.submenuItems && (
                                      <ul style={{ display: subsidebar === item?.label ? "block" : "none" }}>
                                        {(item?.submenuItems as SidebarMenuItem[])?.map((items, k) => {
                                          const isSubSubActive = isMenuItemActive(items, Location.pathname);
                                          return (
                                            <li key={`submenu-item-${k}`}>
                                              <Link
                                                to={items?.submenu ? "#" : items?.link}
                                                className={`${isSubSubActive ? "active" : ""}`}
                                                tabIndex={0}
                                              >
                                                {items?.label}
                                              </Link>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </React.Fragment>
                ))}
              </ul>
            </div>
          </OverlayScrollbarsComponent>
        </div>
      </div>
      {/* Sidenav Menu End */}
    </>
  );
};

export default React.memo(Sidebar);