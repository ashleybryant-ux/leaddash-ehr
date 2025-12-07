import { Link } from "react-router-dom";
import CommonFooter from "../../../components/common-footer/commonFooter";
import ImageWithBasePath from "../../../components/image-with-base-path";
import SettingsTabs from "./SettingsTabs";
import CommonSelect from "../../../components/common-select/commonSelect";
import { City, Country, State } from "../../../core/json/selectOption";
import { all_routes } from "../../../routes/all_routes";
import { useState, useEffect } from "react";

const GeneralSettings = () => {
  const [profileImage, setProfileImage] = useState("assets/img/avatars/avatar-44.jpg");
  const [hospitalName, setHospitalName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState(Country[0]);
  const [state, setState] = useState(State[0]);
  const [city, setCity] = useState(City[0]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('generalSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setProfileImage(settings.profileImage || "assets/img/avatars/avatar-44.jpg");
      setHospitalName(settings.hospitalName || "");
      setEmail(settings.email || "");
      setMobileNumber(settings.mobileNumber || "");
      setAddressLine1(settings.addressLine1 || "");
      setAddressLine2(settings.addressLine2 || "");
      setPincode(settings.pincode || "");
      setCountry(settings.country || Country[0]);
      setState(settings.state || State[0]);
      setCity(settings.city || City[0]);
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setProfileImage("assets/img/avatars/avatar-44.jpg");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settings = {
      profileImage,
      hospitalName,
      email,
      mobileNumber,
      addressLine1,
      addressLine2,
      pincode,
      country,
      state,
      city
    };
    
    localStorage.setItem('generalSettings', JSON.stringify(settings));
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    const savedSettings = localStorage.getItem('generalSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setProfileImage(settings.profileImage || "assets/img/avatars/avatar-44.jpg");
      setHospitalName(settings.hospitalName || "");
      setEmail(settings.email || "");
      setMobileNumber(settings.mobileNumber || "");
      setAddressLine1(settings.addressLine1 || "");
      setAddressLine2(settings.addressLine2 || "");
      setPincode(settings.pincode || "");
      setCountry(settings.country || Country[0]);
      setState(settings.state || State[0]);
      setCity(settings.city || City[0]);
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
                  <li className="breadcrumb-item active">Settings</li>
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
                <h5 className="mb-0 pt-2">Personal Information</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">
                    Profile Image<span className="text-danger ms-1">*</span>
                  </label>
                  <div className="d-flex align-items-center flex-wrap gap-3">
                    <div className="flex-shrink-0">
                      <div className="position-relative d-flex align-items-center border rounded">
                        <img
                          src={profileImage}
                          className="avatar avatar-xxl"
                          alt="profile"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                    <div className="d-inline-flex flex-column align-items-start">
                      <div className="d-inline-flex align-items-start gap-2">
                        <div className="drag-upload-btn btn btn-dark position-relative mb-2">
                          <i className="ti ti-arrows-exchange-2 me-1" />
                          Change Image
                          <input
                            type="file"
                            className="form-control image-sign"
                            accept="image/jpeg,image/png,image/gif"
                            onChange={handleImageChange}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="btn btn-danger d-flex align-items-center gap-1"
                          >
                            <i className="ti ti-trash" /> Remove
                          </button>
                        </div>
                      </div>
                      <span className="fs-13 text-body">
                        Use JPEG, PNG, or GIF. Best size: 200x200 pixels. Keep it under 5MB
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3 pb-3 justify-content-center">
                  <div className="row">
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3 mb-lg-0">
                        <label className="form-label">Hospital Name</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={hospitalName}
                          onChange={(e) => setHospitalName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3 mb-lg-0">
                        <label className="form-label">Email</label>
                        <input 
                          type="email" 
                          className="form-control"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-0 w-100">
                        <label className="form-label d-block">Mobile Number</label>
                        <input
                          type="tel"
                          className="form-control w-100"
                          name="phone"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h5 className="mb-3">Address</h5>
                  <div className="row">
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Address Line 1</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Address Line 2</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Pincode</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Country</label>
                        <CommonSelect
                          options={Country}
                          className="select"
                          defaultValue={country}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">State</label>
                        <CommonSelect
                          options={State}
                          className="select"
                          defaultValue={state}
                        />
                      </div>
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">City</label>
                        <CommonSelect
                          options={City}
                          className="select"
                          defaultValue={city}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-end gap-2">
                  <button 
                    type="button"
                    onClick={handleCancel} 
                    className="btn btn-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
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

export default GeneralSettings;