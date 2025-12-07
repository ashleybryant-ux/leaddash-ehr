import { Link } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import { all_routes } from "../../../routes/all_routes";
import SettingsTabs from "./SettingsTabs";
import {
  FontFamily,
  LanguageSettings,
  SidebarSize,
  Timezone,
} from "../../../core/json/selectOption";
import CommonSelect from "../../../components/common-select/commonSelect";
import ImageWithBasePath from "../../../components/image-with-base-path";
import { useState, useEffect } from "react";

const AppearanceSettings = () => {
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('primary');
  const [expandSidebar, setExpandSidebar] = useState(true);
  const [timezone, setTimezone] = useState(Timezone[0]);
  const [language, setLanguage] = useState(LanguageSettings[0]);
  const [sidebarSize, setSidebarSize] = useState(SidebarSize[0]);
  const [fontFamily, setFontFamily] = useState(FontFamily[0]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('appearanceSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setTheme(settings.theme || 'light');
      setAccentColor(settings.accentColor || 'primary');
      setExpandSidebar(settings.expandSidebar !== false);
      setTimezone(settings.timezone || Timezone[0]);
      setLanguage(settings.language || LanguageSettings[0]);
      setSidebarSize(settings.sidebarSize || SidebarSize[0]);
      setFontFamily(settings.fontFamily || FontFamily[0]);
      
      applySettings(settings);
    }
  }, []);

  const applySettings = (settings: any) => {
    document.documentElement.setAttribute('data-theme', settings.theme || theme);
    document.documentElement.setAttribute('data-color', settings.accentColor || accentColor);
    
    if (settings.fontFamily?.value) {
      document.documentElement.style.setProperty('--font-family', settings.fontFamily.value);
    }
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (settings.expandSidebar !== false) {
        sidebar.classList.remove('mini-sidebar');
      } else {
        sidebar.classList.add('mini-sidebar');
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settings = {
      theme,
      accentColor,
      expandSidebar,
      timezone,
      language,
      sidebarSize,
      fontFamily
    };
    
    localStorage.setItem('appearanceSettings', JSON.stringify(settings));
    applySettings(settings);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleColorChange = (color: string) => {
    setAccentColor(color);
    document.documentElement.setAttribute('data-color', color);
  };

  const handleSidebarToggle = (checked: boolean) => {
    setExpandSidebar(checked);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (checked) {
        sidebar.classList.remove('mini-sidebar');
      } else {
        sidebar.classList.add('mini-sidebar');
      }
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Settings</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={all_routes.generalSettings}>Settings</Link>
                  </li>
                  <li className="breadcrumb-item active">Appearance</li>
                </ol>
              </div>
            </div>
          </div>

          <SettingsTabs />

          {saved && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <i className="ti ti-check me-2"></i>
              Settings saved successfully!
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSaved(false)}
              ></button>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="card mb-0">
              <div className="card-header border-0 pb-1">
                <h5 className="mb-0 pt-2">Appearance</h5>
              </div>
              <div className="card-body">
                <div className="row align-items-center mb-4">
                  <div className="col-xl-7 col-md-4">
                    <div className="mb-3 ">
                      <h6 className="mb-1 fs-14 fw-medium">Select Theme</h6>
                      <span className="fs-13">Choose theme of website</span>
                    </div>
                  </div>
                  <div className="col-xl-5 col-md-8">
                    <div className="row align-items-center">
                      <div className="col-md-4">
                        <div 
                          className={`card theme-image mb-lg-0 ${theme === 'light' ? 'border-primary' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleThemeChange('light')}
                        >
                          <div className="card-body p-2">
                            <div className="border rounded border-gray mb-2">
                              <ImageWithBasePath
                                src="assets/img/theme/light.jpg"
                                className="img-fluid rounded w-100"
                                alt="theme"
                              />
                            </div>
                            <p className={`text-center fw-medium mb-0 fs-13 ${theme === 'light' ? 'text-primary' : ''}`}>
                              Light
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div 
                          className={`card theme-image mb-lg-0 ${theme === 'dark' ? 'border-primary' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleThemeChange('dark')}
                        >
                          <div className="card-body p-2">
                            <div className="border rounded border-gray mb-2">
                              <ImageWithBasePath
                                src="assets/img/theme/dark.jpg"
                                className="img-fluid rounded w-100"
                                alt="theme"
                              />
                            </div>
                            <p className={`text-center fw-medium mb-0 fs-13 ${theme === 'dark' ? 'text-primary' : ''}`}>
                              Dark
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div 
                          className={`card theme-image mb-lg-0 ${theme === 'auto' ? 'border-primary' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleThemeChange('auto')}
                        >
                          <div className="card-body p-2">
                            <div className="border rounded border-gray mb-2">
                              <ImageWithBasePath
                                src="assets/img/theme/automatic.jpg"
                                className="img-fluid rounded w-100"
                                alt="theme"
                              />
                            </div>
                            <p className={`text-center fw-medium mb-0 fs-13 ${theme === 'auto' ? 'text-primary' : ''}`}>
                              Automatic
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row align-items-center">
                  <div className="col-xl-7 col-md-4">
                    <div className="mb-4">
                      <h6 className="mb-1 fs-14 fw-medium">Accent Color</h6>
                      <span className="fs-13">Choose accent colour of website</span>
                    </div>
                  </div>
                  <div className="col-xl-5 col-md-8">
                    <div className="d-flex align-items-center justify-content-xl-end justify-content-start flex-wrap mb-4 gap-2">
                      <div className="theme-colorsset">
                        <input
                          type="radio"
                          name="color"
                          id="primarycolor"
                          checked={accentColor === 'primary'}
                          onChange={() => handleColorChange('primary')}
                        />
                        <label htmlFor="primarycolor" className="primary-clr" />
                      </div>
                      <div className="theme-colorsset">
                        <input 
                          type="radio" 
                          name="color" 
                          id="secondarycolor"
                          checked={accentColor === 'secondary'}
                          onChange={() => handleColorChange('secondary')}
                        />
                        <label htmlFor="secondarycolor" className="secondary-clr" />
                      </div>
                      <div className="theme-colorsset">
                        <input 
                          type="radio" 
                          name="color" 
                          id="successcolor"
                          checked={accentColor === 'success'}
                          onChange={() => handleColorChange('success')}
                        />
                        <label htmlFor="successcolor" className="success-clr" />
                      </div>
                      <div className="theme-colorsset">
                        <input 
                          type="radio" 
                          name="color" 
                          id="dangercolor"
                          checked={accentColor === 'danger'}
                          onChange={() => handleColorChange('danger')}
                        />
                        <label htmlFor="dangercolor" className="danger-clr" />
                      </div>
                      <div className="theme-colorsset">
                        <input 
                          type="radio" 
                          name="color" 
                          id="infocolor"
                          checked={accentColor === 'info'}
                          onChange={() => handleColorChange('info')}
                        />
                        <label htmlFor="infocolor" className="info-clr" />
                      </div>
                      <div className="theme-colorsset">
                        <input 
                          type="radio" 
                          name="color" 
                          id="warningcolor"
                          checked={accentColor === 'warning'}
                          onChange={() => handleColorChange('warning')}
                        />
                        <label htmlFor="warningcolor" className="warning-clr" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row align-items-centergap-lg-0 gap-md-0 gap-2 mb-4">
                  <div className="col-xl-9 col-md-4">
                    <div>
                      <h6 className="mb-1 fs-14 fw-medium">Expand Sidebar</h6>
                      <span className="fs-13">Choose expand sidebar</span>
                    </div>
                  </div>
                  <div className="col-xl-3 col-md-4 d-flex align-items-center justify-content-xl-end">
                    <label className="d-flex align-items-center justify-content-xl-end form-switch ps-2">
                      <input
                        className="form-check-input m-0 me-2"
                        type="checkbox"
                        checked={expandSidebar}
                        onChange={(e) => handleSidebarToggle(e.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                <div className="row align-items-centergap-lg-0 gap-md-0 gap-2 mb-4">
                  <div className="col-xl-9 col-md-4">
                    <div>
                      <h6 className="mb-1 fs-14 fw-medium">Timezone</h6>
                      <span className="fs-13">Select timezone to display</span>
                    </div>
                  </div>
                  <div className="col-xl-3 col-md-4">
                    <div>
                      <CommonSelect
                        options={Timezone}
                        className="select"
                        defaultValue={timezone}
                      />
                    </div>
                  </div>
                </div>

                <div className="row align-items-centergap-lg-0 gap-md-0 gap-2 mb-4">
                  <div className="col-xl-9 col-md-4">
                    <div>
                      <h6 className="mb-1 fs-14 fw-medium">Language</h6>
                      <span className="fs-13">Select language to display</span>
                    </div>
                  </div>
                  <div className="col-xl-3 col-md-4">
                    <div>
                      <CommonSelect
                        options={LanguageSettings}
                        className="select"
                        defaultValue={language}
                      />
                    </div>
                  </div>
                </div>

                <div className="row align-items-centergap-lg-0 gap-md-0 gap-2 mb-4">
                  <div className="col-xl-9 col-md-4">
                    <div>
                      <h6 className="mb-1 fs-14 fw-medium">Sidebar Size</h6>
                      <span className="fs-13">Choose sidebar size</span>
                    </div>
                  </div>
                  <div className="col-xl-3 col-md-4">
                    <CommonSelect
                      options={SidebarSize}
                      className="select"
                      defaultValue={sidebarSize}
                    />
                  </div>
                </div>

                <div className="row align-items-centergap-lg-0 gap-md-0 gap-2 mb-0">
                  <div className="col-xl-9 col-md-4">
                    <div>
                      <h6 className="mb-1 fs-14 fw-medium">Font Family</h6>
                      <span className="fs-13">Select font family of website</span>
                    </div>
                  </div>
                  <div className="col-xl-3 col-md-4">
                    <CommonSelect
                      options={FontFamily}
                      className="select"
                      defaultValue={fontFamily}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 border-top mt-4 pt-3">
                  <Link
                    to={all_routes.generalSettings}
                    className="btn btn-outline-light me-2"
                  >
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary">
                    <i className="ti ti-device-floppy me-1"></i>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <CommonFooter />
      </div>
    </>
  );
};

export default AppearanceSettings;