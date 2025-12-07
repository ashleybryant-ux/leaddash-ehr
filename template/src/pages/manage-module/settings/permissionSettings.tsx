import { Link } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import { all_routes } from "../../../routes/all_routes";
import SettingsTabs from "./SettingsTabs";
import { useState, useEffect } from "react";

interface ModulePermissions {
  create: boolean;
  edit: boolean;
  delete: boolean;
  view: boolean;
}

interface PermissionsState {
  main: Record<string, ModulePermissions>;
  medical: Record<string, ModulePermissions>;
  manage: Record<string, ModulePermissions>;
}

const PermissionSettings = () => {
  const [permissions, setPermissions] = useState<PermissionsState>({
    main: {
      patients: { create: true, edit: false, delete: false, view: false },
      doctors: { create: false, edit: true, delete: false, view: false },
      visits: { create: false, edit: false, delete: true, view: false },
      requests: { create: false, edit: false, delete: false, view: true },
      appointments: { create: false, edit: true, delete: false, view: false },
      laboratory: { create: true, edit: false, delete: false, view: false },
      messages: { create: false, edit: true, delete: false, view: false },
      contacts: { create: false, edit: false, delete: true, view: false },
      notifications: { create: false, edit: false, delete: false, view: true }
    },
    medical: {
      labResults: { create: true, edit: false, delete: false, view: false },
      medicalRecords: { create: false, edit: true, delete: false, view: false }
    },
    manage: {
      pharmacy: { create: true, edit: false, delete: false, view: false },
      staffs: { create: false, edit: true, delete: false, view: false },
      settings: { create: false, edit: false, delete: true, view: false }
    }
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedPermissions = localStorage.getItem('permissionSettings');
    if (savedPermissions) {
      setPermissions(JSON.parse(savedPermissions));
    }
  }, []);

  const handleToggle = (
    section: keyof PermissionsState,
    module: string,
    permission: keyof ModulePermissions
  ) => {
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [module]: {
          ...prev[section][module],
          [permission]: !prev[section][module][permission]
        }
      }
    }));
  };

  const handleAllowAll = (section: keyof PermissionsState, module: string) => {
    const currentModule = permissions[section][module];
    const allEnabled = Object.values(currentModule).every(v => v);
    
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [module]: {
          create: !allEnabled,
          edit: !allEnabled,
          delete: !allEnabled,
          view: !allEnabled
        }
      }
    }));
  };

  const handleSectionAllowAll = (section: keyof PermissionsState, checked: boolean) => {
    const updatedSection: Record<string, ModulePermissions> = {};
    Object.keys(permissions[section]).forEach(module => {
      updatedSection[module] = {
        create: checked,
        edit: checked,
        delete: checked,
        view: checked
      };
    });
    
    setPermissions(prev => ({
      ...prev,
      [section]: updatedSection
    }));
  };

  const isSectionAllEnabled = (section: keyof PermissionsState) => {
    return Object.values(permissions[section]).every(module =>
      Object.values(module).every(v => v)
    );
  };

  const isModuleAllEnabled = (section: keyof PermissionsState, module: string) => {
    const modulePerms = permissions[section][module];
    return Object.values(modulePerms).every(v => v);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('permissionSettings', JSON.stringify(permissions));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    const savedPermissions = localStorage.getItem('permissionSettings');
    if (savedPermissions) {
      setPermissions(JSON.parse(savedPermissions));
    }
  };

  const renderPermissionRow = (
    section: keyof PermissionsState,
    module: string,
    label: string
  ) => {
    const perms = permissions[section][module];
    
    return (
      <tr key={module}>
        <td>{label}</td>
        <td>
          <div className="form-check form-check-md">
            <input
              className="form-check-input mt-0"
              type="checkbox"
              checked={perms.create}
              onChange={() => handleToggle(section, module, 'create')}
            />
          </div>
        </td>
        <td>
          <div className="form-check form-check-md">
            <input
              className="form-check-input"
              type="checkbox"
              checked={perms.edit}
              onChange={() => handleToggle(section, module, 'edit')}
            />
          </div>
        </td>
        <td>
          <div className="form-check form-check-md">
            <input
              className="form-check-input"
              type="checkbox"
              checked={perms.delete}
              onChange={() => handleToggle(section, module, 'delete')}
            />
          </div>
        </td>
        <td>
          <div className="form-check form-check-md">
            <input
              className="form-check-input"
              type="checkbox"
              checked={perms.view}
              onChange={() => handleToggle(section, module, 'view')}
            />
          </div>
        </td>
        <td>
          <div className="form-check form-check-md">
            <input
              className="form-check-input"
              type="checkbox"
              checked={isModuleAllEnabled(section, module)}
              onChange={() => handleAllowAll(section, module)}
            />
          </div>
        </td>
      </tr>
    );
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
                  <li className="breadcrumb-item active">Permissions</li>
                </ol>
              </div>
            </div>
          </div>

          <SettingsTabs/>

          {saved && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <i className="ti ti-check me-2"></i>
              Permission settings saved successfully!
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSaved(false)}
              ></button>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h5 className="mb-0">Main</h5>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-check-input mt-0"
                  type="checkbox"
                  id="select-all"
                  checked={isSectionAllEnabled('main')}
                  onChange={(e) => handleSectionAllowAll('main', e.target.checked)}
                />
                <label htmlFor="select-all">Allow All</label>
              </div>
            </div>
            <div className="card-body">
              <div className="table-responsive table-nowrap">
                <table className="table border mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="w-50">Module</th>
                      <th>Create</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>View</th>
                      <th>Allow All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderPermissionRow('main', 'patients', 'Patients')}
                    {renderPermissionRow('main', 'doctors', 'Doctors')}
                    {renderPermissionRow('main', 'visits', 'Visits')}
                    {renderPermissionRow('main', 'requests', 'Requests')}
                    {renderPermissionRow('main', 'appointments', 'Appointments')}
                    {renderPermissionRow('main', 'laboratory', 'Laboratory')}
                    {renderPermissionRow('main', 'messages', 'Messages')}
                    {renderPermissionRow('main', 'contacts', 'Contacts')}
                    {renderPermissionRow('main', 'notifications', 'Notifications')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h5 className="mb-0">Medical</h5>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-check-input mt-0"
                  type="checkbox"
                  id="allow-02"
                  checked={isSectionAllEnabled('medical')}
                  onChange={(e) => handleSectionAllowAll('medical', e.target.checked)}
                />
                <label htmlFor="allow-02">Allow All</label>
              </div>
            </div>
            <div className="card-body">
              <div className="table-responsive table-nowrap">
                <table className="table border mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="w-50">Module</th>
                      <th>Create</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>View</th>
                      <th>Allow All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderPermissionRow('medical', 'labResults', 'Lab Results')}
                    {renderPermissionRow('medical', 'medicalRecords', 'Medical Records')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-0">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h5 className="mb-0">Manage</h5>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-check-input mt-0"
                  type="checkbox"
                  id="allow-01"
                  checked={isSectionAllEnabled('manage')}
                  onChange={(e) => handleSectionAllowAll('manage', e.target.checked)}
                />
                <label htmlFor="allow-01">Allow All</label>
              </div>
            </div>
            <div className="card-body">
              <div className="table-responsive table-nowrap">
                <table className="table border mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="w-50">Module</th>
                      <th>Create</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>View</th>
                      <th>Allow All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderPermissionRow('manage', 'pharmacy', 'Pharmacy')}
                    {renderPermissionRow('manage', 'staffs', 'Staffs')}
                    {renderPermissionRow('manage', 'settings', 'Settings')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-end gap-2 border-top mt-4 pt-3">
            <button 
              type="button"
              onClick={handleCancel} 
              className="btn btn-white"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSave} 
              className="btn btn-primary"
            >
              <i className="ti ti-device-floppy me-1"></i>
              Save Changes
            </button>
          </div>
        </div>

        <CommonFooter />
      </div>
    </>
  );
};

export default PermissionSettings;