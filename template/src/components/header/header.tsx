import React from "react";
import { Link, useLocation } from "react-router-dom";
import ImageWithBasePath from "../image-with-base-path";
import { all_routes } from "../../routes/all_routes";
import { useDispatch, useSelector } from "react-redux";
import { setMobileSidebar, toggleHiddenLayout } from "../../core/redux/sidebarSlice";
import { useEffect, useState, useRef, useCallback } from "react";
import { updateTheme } from "../../core/redux/themeSlice";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Patient {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
}

const Header = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const themeSettings = useSelector((state: any) => state.theme.themeSettings);
  const hiddenLayout = useSelector((state: any) => state.sidebarSlice.hiddenLayout);

  const mobileSidebar = useSelector(
    (state: any) => state.sidebarSlice.mobileSidebar
  );

  // Check if current page is a layout page
  const isLayoutPage = () => {
    const layoutPaths = [
      all_routes.layoutMini,
      all_routes.layoutHoverview,
      all_routes.layoutHidden,
      all_routes.layoutFullwidth,
      all_routes.layoutRtl,
      all_routes.layoutDark
    ];
    return layoutPaths.includes(location.pathname);
  };
  
  const toggleMobileSidebar = useCallback(() => {
    dispatch(setMobileSidebar(!mobileSidebar));
  }, [dispatch, mobileSidebar]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  const handleUpdateTheme = useCallback(
    (key: string, value: string) => {
      if (themeSettings["dir"] === "rtl" && key !== "dir") {
        dispatch(updateTheme({ dir: "ltr" }));
      }
      dispatch(updateTheme({ [key]: value }));
    },
    [dispatch, themeSettings]
  );

  // Extract themeSettings dependencies for useEffect
  const themeDeps = [
    themeSettings["data-bs-theme"],
    themeSettings["dir"],
    themeSettings["data-layout"],
    themeSettings["data-sidebar"],
    themeSettings["data-color"],
    themeSettings["data-topbar"],
    themeSettings["data-size"],
    themeSettings["data-width"],
    themeSettings["data-sidebarbg"],
  ];
  
  useEffect(() => {
    const htmlElement = document.documentElement as HTMLElement;
    Object.entries(themeSettings).forEach(([key, value]) => {
      htmlElement.setAttribute(key as string, String(value));
    });
  }, themeDeps);

  // Client Search State
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);

  // Search for clients
  const searchClients = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const locationId = localStorage.getItem("locationId");
      const response = await axios.get(`${API_URL}/api/patients`, {
        params: { 
          locationId, 
          limit: 100,
          sync: 'false'
        }
      });

      if (response.data.success) {
        const patients = response.data.patients || [];
        const filtered = patients.filter((p: Patient) => {
          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
          const searchLower = query.toLowerCase();
          return fullName.includes(searchLower) || 
                 (p.email && p.email.toLowerCase().includes(searchLower)) ||
                 (p.phone && p.phone.includes(query));
        }).slice(0, 8);
        
        setSearchResults(filtered);
        setShowResults(true);
      }
    } catch (error) {
      console.error("Error searching clients:", error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, searchClients]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDesktop = searchContainerRef.current && !searchContainerRef.current.contains(target);
      const isOutsideMobile = mobileSearchContainerRef.current && !mobileSearchContainerRef.current.contains(target);
      
      // Only close if click is outside BOTH containers (or if a container doesn't exist)
      if ((isOutsideDesktop || !searchContainerRef.current) && 
          (isOutsideMobile || !mobileSearchContainerRef.current)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.target.value);
    },
    []
  );

  const handleToggleBtn2Click = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (themeSettings["data-layout"] === "hidden") {
      dispatch(toggleHiddenLayout());
    } else {
      toggleMobileSidebar();
    }
  }, [dispatch, toggleMobileSidebar, themeSettings, hiddenLayout]);

  const handleDarkModeClick = useCallback(() => {
    handleUpdateTheme("data-bs-theme", "light");
  }, [handleUpdateTheme]);
  
  const handleLightModeClick = useCallback(() => {
    handleUpdateTheme("data-bs-theme", "dark");
  }, [handleUpdateTheme]);

  return (
    <>
      {/* Topbar Start */}
      <header className="navbar-header">
        <div className="page-container topbar-menu">
          <div className="d-flex align-items-center gap-sm-2 gap-1">
            {/* Sidebar Mobile Button */}
            <Link
              id="mobile_btn"
              className="mobile-btn"
              to="#sidebar"
              onClick={toggleMobileSidebar}
              aria-label="Toggle mobile sidebar"
            >
              <i className="ti ti-menu-deep fs-24" aria-hidden="true" />
            </Link>
            {/* Logo */}
            <Link to={all_routes.dashboard} className="logo">
              {/* Logo Normal */}
              <span className="logo-light">
                <span className="logo-lg">
                  <ImageWithBasePath src="assets/img/logo.svg" alt="logo" />
                </span>
              </span>
              {/* Logo Dark */}
              <span className="logo-dark">
                <span className="logo-lg">
                  <ImageWithBasePath
                    src="assets/img/logo-dark.svg"
                    alt="dark logo"
                  />
                </span>
              </span>

              {/* Logo sm */}
              <span className="logo-small">
                <span className="logo-lg">
                  <ImageWithBasePath
                    src="assets/img/logo-small.svg"
                    alt="small logo"
                  />
                </span>
              </span>
            </Link>
            <button
              className="sidenav-toggle-btn btn border-0 p-0 active"
              id="toggle_btn2"
              onClick={handleToggleBtn2Click}
              aria-label="Toggle sidebar"
              type="button"
            >
              <i className="ti ti-arrow-bar-to-right" aria-hidden="true" />
            </button>
            
            {/* Client Search */}
            <div className="me-auto d-flex align-items-center header-search d-lg-flex d-none" ref={searchContainerRef}>
              <div className="input-icon position-relative me-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search clients..."
                  value={searchValue}
                  onChange={handleSearchInputChange}
                  ref={searchInputRef}
                  onFocus={() => searchValue.length >= 2 && setShowResults(true)}
                  aria-label="Search clients"
                />
                <span className="input-icon-addon d-inline-flex p-0 header-search-icon">
                  {searching ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="ti ti-search" aria-hidden="true" />
                  )}
                </span>
                
                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div 
                    className="position-absolute top-100 start-0 w-100 bg-white border rounded shadow-lg mt-1" 
                    style={{ zIndex: 9999, minWidth: '300px' }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="p-2 border-bottom bg-light">
                      <small className="text-muted">{searchResults.length} client(s) found</small>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {searchResults.map((patient) => (
                        <div
                          key={patient.id}
                          className="d-flex align-items-center p-2 border-bottom search-result-item"
                          role="button"
                          tabIndex={0}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Navigating to patient:', patient.id);
                            setShowResults(false);
                            setSearchValue("");
                            window.location.href = `/patients/${patient.id}`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setShowResults(false);
                              setSearchValue("");
                              window.location.href = `/patients/${patient.id}`;
                            }
                          }}
                        >
                          <div className="avatar avatar-sm bg-primary-light rounded-circle me-2 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                            <span className="text-primary fw-bold" style={{ fontSize: '12px' }}>
                              {(patient.firstName?.[0] || '')}{(patient.lastName?.[0] || '')}
                            </span>
                          </div>
                          <div className="flex-grow-1 text-start">
                            <div className="fw-medium text-dark">
                              {patient.firstName} {patient.lastName}
                            </div>
                            {patient.phone && (
                              <small className="text-muted">{patient.phone}</small>
                            )}
                          </div>
                          <i className="ti ti-chevron-right text-muted" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* No Results */}
                {showResults && searchValue.length >= 2 && searchResults.length === 0 && !searching && (
                  <div className="position-absolute top-100 start-0 w-100 bg-white border rounded shadow-lg mt-1 p-3 text-center" style={{ zIndex: 1050 }}>
                    <i className="ti ti-user-off text-muted fs-4 d-block mb-2" />
                    <small className="text-muted">No clients found</small>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="d-flex align-items-center">
            {/* Mobile Client Search */}
            <div className="me-auto d-flex align-items-center header-search d-lg-none d-sm-flex d-none" ref={mobileSearchContainerRef}>
              <div className="input-icon position-relative me-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search clients..."
                  value={searchValue}
                  onChange={handleSearchInputChange}
                  onFocus={() => searchValue.length >= 2 && setShowResults(true)}
                  aria-label="Search clients"
                />
                <span className="input-icon-addon d-inline-flex p-0 header-search-icon">
                  {searching ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="ti ti-search" aria-hidden="true" />
                  )}
                </span>
              </div>
            </div>
            
            {/* Fullscreen Toggle */}
            <div className="header-item">
              <div className="dropdown me-2">
                <Link
                  to="#"
                  className="btn topbar-link btnFullscreen"
                  onClick={toggleFullscreen}
                  aria-label="Toggle fullscreen"
                >
                  <i className="ti ti-minimize" aria-hidden="true" />
                </Link>
              </div>
            </div>
            
            {/* Light/Dark Mode Button */}
            {!isLayoutPage() && (
              <div className="header-item d-flex">
                <button
                  className={`topbar-link btn topbar-link ${
                    themeSettings["mode"] === "dark" ? "active" : ""
                  }`}
                  id="dark-mode-toggle"
                  type="button"
                  onClick={handleDarkModeClick}
                  aria-label="Switch to light mode"
                >
                  <i className="ti ti-sun fs-16" aria-hidden="true" />
                </button>
                <button
                  className={`topbar-link btn topbar-link ${
                    themeSettings["mode"] === "light" ? "active" : ""
                  }`}
                  id="light-mode-toggle"
                  type="button"
                  onClick={handleLightModeClick}
                  aria-label="Switch to dark mode"
                >
                  <i className="ti ti-moon fs-16" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Topbar End */}
      
      <style>{`
        .bg-primary-light {
          background-color: rgba(13, 110, 253, 0.1);
        }
        .search-result-item {
          cursor: pointer;
          background-color: white;
          transition: background-color 0.15s ease;
        }
        .search-result-item:hover {
          background-color: #f8f9fa !important;
        }
      `}</style>
    </>
  );
};

export default React.memo(Header);