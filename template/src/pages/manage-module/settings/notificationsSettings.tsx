import { Link } from "react-router-dom"
import CommonFooter from "../../../components/common-footer/commonFooter"
import { all_routes } from "../../../routes/all_routes"
import SettingsTabs from "./SettingsTabs"
import { useState, useEffect } from "react"

interface NotificationSettings {
  emailNotifications: { push: boolean; email: boolean; sms: boolean };
  appointmentAlerts: { push: boolean; email: boolean; sms: boolean };
  subscriptionAlerts: { push: boolean; email: boolean; sms: boolean };
  securityAlerts: { push: boolean; email: boolean; sms: boolean };
  deviceLoginAlerts: { push: boolean; email: boolean; sms: boolean };
}

const NotificationsSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: { push: false, email: true, sms: true },
    appointmentAlerts: { push: true, email: false, sms: true },
    subscriptionAlerts: { push: true, email: true, sms: false },
    securityAlerts: { push: true, email: false, sms: true },
    deviceLoginAlerts: { push: false, email: true, sms: true }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleToggle = (category: keyof NotificationSettings, type: 'push' | 'email' | 'sms') => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category][type]
      }
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
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
                  <li className="breadcrumb-item active">Notifications</li>
                </ol>
              </div>
            </div>
          </div>

          <SettingsTabs/>

          {saved && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <i className="ti ti-check me-2"></i>
              Notification settings saved successfully!
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
                <h5 className="mb-0 pt-2">Notifications</h5>
              </div>
              <div className="card-body">
                <div className="table-responsive table-nowrap">
                  <table className="table border mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="w-75">General Notifications</th>
                        <th className="text-grey fw-regular">Push</th>
                        <th className="text-grey fw-regular">Email</th>
                        <th className="text-grey fw-regular">SMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-0">Email Notifications</td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.emailNotifications.push}
                              onChange={() => handleToggle('emailNotifications', 'push')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.emailNotifications.email}
                              onChange={() => handleToggle('emailNotifications', 'email')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.emailNotifications.sms}
                              onChange={() => handleToggle('emailNotifications', 'sms')}
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="border-0">Appointment Alerts</td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.appointmentAlerts.push}
                              onChange={() => handleToggle('appointmentAlerts', 'push')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.appointmentAlerts.email}
                              onChange={() => handleToggle('appointmentAlerts', 'email')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.appointmentAlerts.sms}
                              onChange={() => handleToggle('appointmentAlerts', 'sms')}
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="border-0">Subscription Alerts</td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.subscriptionAlerts.push}
                              onChange={() => handleToggle('subscriptionAlerts', 'push')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.subscriptionAlerts.email}
                              onChange={() => handleToggle('subscriptionAlerts', 'email')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.subscriptionAlerts.sms}
                              onChange={() => handleToggle('subscriptionAlerts', 'sms')}
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="border-0">Security Alerts</td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.securityAlerts.push}
                              onChange={() => handleToggle('securityAlerts', 'push')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.securityAlerts.email}
                              onChange={() => handleToggle('securityAlerts', 'email')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.securityAlerts.sms}
                              onChange={() => handleToggle('securityAlerts', 'sms')}
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="border-0">Device Login Alerts</td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.deviceLoginAlerts.push}
                              onChange={() => handleToggle('deviceLoginAlerts', 'push')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.deviceLoginAlerts.email}
                              onChange={() => handleToggle('deviceLoginAlerts', 'email')}
                            />
                          </div>
                        </td>
                        <td className="border-0">
                          <div className="form-check form-switch p-0 d-flex align-items-center">
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              checked={settings.deviceLoginAlerts.sms}
                              onChange={() => handleToggle('deviceLoginAlerts', 'sms')}
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="d-flex align-items-center justify-content-end gap-2 border-top mt-4 pt-3">
                  <button
                    type="button"
                    className="btn btn-outline-light me-2"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="ti ti-device-floppy me-1"></i>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <CommonFooter/>
      </div>
    </>
  )
}

export default NotificationsSettings