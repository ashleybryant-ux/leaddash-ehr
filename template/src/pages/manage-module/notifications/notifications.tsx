import { Link } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import { all_routes } from "../../../routes/all_routes";
import ImageWithBasePath from "../../../components/image-with-base-path";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../../config';

const API_URL = config.apiUrl;

interface Notification {
  id: string;
  type: string;
  message: string;
  patientName: string;
  patientId: string;
  patientAvatar?: string;
  timestamp: string;
  isRead: boolean;
  metadata?: {
    appointmentDate?: string;
    appointmentTime?: string;
  };
}

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('locationId');
    
    if (locId) {
      setLocationId(locId);
      fetchNotifications(locId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = async (locId: string) => {
    setLoading(true);
    try {
      console.log('📬 Fetching notifications...');
      
      const response = await axios.get(`${API_URL}/api/notifications`, {
        params: { locationId: locId }
      });

      if (response.data?.notifications) {
        setNotifications(response.data.notifications);
        console.log('✅ Notifications loaded:', response.data.notifications.length);
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API_URL}/api/notifications/mark-all-read`, {
        locationId
      });
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${notificationId}`, {
        params: { locationId }
      });
      
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await axios.delete(`${API_URL}/api/notifications/all`, {
        params: { locationId }
      });
      
      setNotifications([]);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Notifications</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Notifications</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <button
                onClick={() => fetchNotifications(locationId)}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'rotating' : ''}`} />
              </button>
            </div>
          </div>

          <div className="card mb-0">
            <div className="card-header d-flex align-items-center flex-wrap gap-3 justify-content-between">
              <h5 className="d-inline-flex align-items-center mb-0">
                Notifications
                {unreadCount > 0 && (
                  <span className="badge bg-danger ms-2">{unreadCount}</span>
                )}
              </h5>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="btn btn-outline-light">
                    <i className="ti ti-checks me-1" />
                    Mark all as read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAllNotifications}
                    className="btn btn-danger"
                  >
                    <i className="ti ti-trash me-1" />
                    Delete All
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-bell-off fs-48 text-muted mb-3"></i>
                  <p className="text-muted">No notifications yet</p>
                </div>
              ) : (
                <>
                  {notifications.map((notification, index) => (
                    <div 
                      key={notification.id} 
                      className={`card notication-card ${index === notifications.length - 1 ? 'mb-0' : 'mb-3'}`}
                    >
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div className="d-flex align-items-center">
                            <Link
                              to={`${all_routes.patientDetails}?patientId=${notification.patientId}&locationId=${locationId}`}
                              className="avatar flex-shrink-0"
                            >
                              {notification.patientAvatar ? (
                                <ImageWithBasePath
                                  src={notification.patientAvatar}
                                  alt="patient"
                                  className="rounded-circle"
                                />
                              ) : (
                                <span className="avatar-text rounded-circle bg-primary text-white">
                                  {notification.patientName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </Link>
                            <div className="ms-2">
                              <div>
                                <p className="mb-1">
                                  <Link
                                    to={`${all_routes.patientDetails}?patientId=${notification.patientId}&locationId=${locationId}`}
                                    className="fw-medium"
                                  >
                                    {notification.patientName}
                                  </Link>{' '}
                                  {notification.message}
                                  {notification.metadata?.appointmentDate && (
                                    <span className="text-dark fw-medium">
                                      {' '}{notification.metadata.appointmentDate}
                                      {notification.metadata.appointmentTime && 
                                        ` at ${notification.metadata.appointmentTime}`
                                      }
                                    </span>
                                  )}
                                </p>
                                <p className="fs-12 mb-0 d-inline-flex align-items-center">
                                  <i className="ti ti-clock me-1" />
                                  {getTimeAgo(notification.timestamp)}
                                  {!notification.isRead && (
                                    <span className="ms-2">
                                      <i className="ti ti-point-filled text-danger fs-16 lh-sm" />
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="noti-btn">
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="btn btn-danger d-inline-flex align-items-center"
                            >
                              <i className="ti ti-trash me-1" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <CommonFooter />
      </div>
    </>
  );
};

export default Notifications;