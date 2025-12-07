import ImageWithBasePath from "../../../components/image-with-base-path";
import { useState } from "react";
import { all_routes } from "../../../routes/all_routes";
import { Link, useNavigate } from "react-router-dom";
import axios from 'axios';
import config from '../../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

type PasswordField = "password" | "confirmPassword";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    rememberMe: false,
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setError("");
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🔐 Creating account in LeadDash...');
      
      const response = await axios.post(
        `${API_URL}/api/patients`,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || '',
          source: 'EMR Signup',
          tags: ['patient', 'signup'],
          customField: {
            password: formData.password
          }
        },
        {
          params: { locationId: LOCATION_ID }
        }
      );

      if (response.data.success) {
        console.log('✅ Account created in LeadDash:', response.data.patient.id);
        
        setShowSuccess(true);
        
        localStorage.setItem('userEmail', formData.email);
        localStorage.setItem('userId', response.data.patient.id);
        localStorage.setItem('userName', `${formData.firstName} ${formData.lastName}`);
        
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          rememberMe: false,
        });
        
        setTimeout(() => {
          try {
            navigate(all_routes.login);
          } catch (error) {
            window.location.href = all_routes.login;
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Error creating account:', error);
      
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else if (error.message) {
        setError(`Failed to create account: ${error.message}`);
      } else {
        setError('Failed to create account. Please try again.');
      }
      
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="container-fuild position-relative z-1">
        <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100 bg-white lock-screen-cover">
          <div className="row">
            <div className="col-lg-6 col-md-12 col-sm-12">
              <div className="row justify-content-center align-items-center overflow-auto flex-wrap vh-100">
                <div className="col-md-8 mx-auto">
                  <form className="d-flex justify-content-center align-items-center" onSubmit={handleSubmit}>
                    <div className="d-flex flex-column justify-content-lg-center flex-fill">
                      <div className="card border-1 p-lg-3 shadow-md rounded-3 m-0">
                        <div className="card-body">
                          <div className="mb-4">
                            <Link to={all_routes.dashboard} className="logo">
                              <ImageWithBasePath src="assets/img/logo-dark.svg" className="img-fluid logo" alt="Logo" />
                            </Link>
                          </div>
                          <div className="mb-3">
                            <h5 className="mb-1 fw-bold">Sign Up</h5>
                            <p className="text-muted fs-14 mb-0">Create your EMR account</p>
                          </div>

                          <div className="alert alert-info mb-3">
                            <i className="ti ti-plug-connected me-2"></i>
                            <small>Your account will be created in LeadDash</small>
                          </div>

                          {error && (
                            <div className="alert alert-danger mb-3" role="alert">
                              <i className="ti ti-alert-circle me-2"></i>
                              {error}
                            </div>
                          )}

                          {showSuccess && (
                            <div className="alert alert-success mb-3" role="alert">
                              <i className="ti ti-check-circle me-2"></i>
                              Account created successfully! Redirecting to login page...
                            </div>
                          )}

                          <div className="row">
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">
                                  First Name<span className="text-danger ms-1">*</span>
                                </label>
                                <div className="input-group input-group-flat">
                                  <input type="text" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} className="form-control border-end-0" required />
                                  <span className="input-group-text bg-white">
                                    <i className="ti ti-user fs-14 text-dark" />
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">
                                  Last Name<span className="text-danger ms-1">*</span>
                                </label>
                                <div className="input-group input-group-flat">
                                  <input type="text" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} className="form-control border-end-0" required />
                                  <span className="input-group-text bg-white">
                                    <i className="ti ti-user fs-14 text-dark" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">
                              Email<span className="text-danger ms-1">*</span>
                            </label>
                            <div className="input-group input-group-flat">
                              <input type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="form-control border-end-0" required />
                              <span className="input-group-text bg-white">
                                <i className="ti ti-mail fs-14 text-dark" />
                              </span>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">Phone Number (Optional)</label>
                            <div className="input-group input-group-flat">
                              <input type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} className="form-control border-end-0" placeholder="+1 (555) 123-4567" />
                              <span className="input-group-text bg-white">
                                <i className="ti ti-phone fs-14 text-dark" />
                              </span>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">
                              Password<span className="text-danger ms-1">*</span>
                            </label>
                            <div className="input-group input-group-flat pass-group">
                              <input type={passwordVisibility.password ? "text" : "password"} value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} className="form-control pass-input" placeholder="Min. 6 characters" required />
                              <span className={`ti toggle-password input-group-text toggle-password ${passwordVisibility.password ? "ti-eye" : "ti-eye-off"}`} onClick={() => togglePasswordVisibility("password")}></span>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">
                              Confirm Password<span className="text-danger ms-1">*</span>
                            </label>
                            <div className="input-group input-group-flat pass-group">
                              <input type={passwordVisibility.confirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} className="form-control pass-input" placeholder="Re-enter password" required />
                              <span className={`ti toggle-password input-group-text toggle-password ${passwordVisibility.confirmPassword ? "ti-eye" : "ti-eye-off"}`} onClick={() => togglePasswordVisibility("confirmPassword")}></span>
                            </div>
                          </div>

                          <div className="d-flex align-items-center justify-content-between mb-3">
                            <div className="d-flex align-items-center">
                              <div className="form-check form-check-md mb-0">
                                <input className="form-check-input" id="remember_me" type="checkbox" checked={formData.rememberMe} onChange={(e) => handleInputChange("rememberMe", e.target.checked)} />
                                <label htmlFor="remember_me" className="form-check-label mt-0">I agree to Terms &amp; Privacy</label>
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <button type="submit" className="btn bg-primary text-white w-100" disabled={isSubmitting || showSuccess}>
                              {isSubmitting ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                  Creating account...
                                </>
                              ) : showSuccess ? (
                                <>
                                  <i className="ti ti-check-circle me-2"></i>
                                  Account Created!
                                </>
                              ) : (
                                "Create account"
                              )}
                            </button>
                          </div>

                          <div className="login-or position-relative my-1 py-2 text-center fw-medium">
                            <span className="position-relative bg-white px-2 z-2">Or</span>
                          </div>

                          <div className="mb-3">
                            <div className="d-flex align-items-center justify-content-center flex-wrap">
                              <div className="text-center me-2 flex-fill">
                                <a href="#" className="br-10 p-1 btn btn-light d-flex align-items-center justify-content-center">
                                  <ImageWithBasePath className="img-fluid m-1" src="assets/img/icons/google.svg" alt="Google" />
                                  Google
                                </a>
                              </div>
                              <div className="text-center flex-fill">
                                <a href="#" className="br-10 p-1 btn btn-light d-flex align-items-center justify-content-center">
                                  <ImageWithBasePath className="img-fluid m-1" src="assets/img/icons/facebook.svg" alt="Facebook" />
                                  Facebook
                                </a>
                              </div>
                            </div>
                          </div>

                          <div className="text-center">
                            <h6 className="fw-normal fs-14 text-dark mb-0">
                              Already have an account?
                              <Link to={all_routes.login} className="ms-1 text-primary">Sign In</Link>
                            </h6>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-6 p-0">
              <div className="login-backgrounds login-covers bg-primary d-lg-flex align-items-center justify-content-center d-none flex-wrap position-relative h-100 z-0">
                <div className="authentication-card">
                  <div className="authen-overlay-item w-100">
                    <div className="authen-head text-center">
                      <h1 className="text-white fs-28 fw-bold mb-2">Your Wellness Journey Starts Here</h1>
                      <p className="text-light fw-normal text-light mb-0">Our Medical Website Admin Template offers an intuitive interface for efficient administration and organization of medical data</p>
                    </div>
                  </div>
                  <div className="auth-person">
                    <ImageWithBasePath src="assets/img/auth/auth-img-06.png" alt="doctor" className="img-fluid" />
                  </div>
                </div>
                <ImageWithBasePath src="assets/img/auth/auth-img-01.png" alt="shadow" className="position-absolute top-0 start-0" />
                <ImageWithBasePath src="assets/img/auth/auth-img-02.png" alt="bubble" className="img-fluid position-absolute top-0 end-0" />
                <ImageWithBasePath src="assets/img/auth/auth-img-03.png" alt="shadow" className="img-fluid position-absolute auth-img-01" />
                <ImageWithBasePath src="assets/img/auth/auth-img-04.png" alt="bubble" className="img-fluid position-absolute auth-img-02" />
                <ImageWithBasePath src="assets/img/auth/auth-img-05.png" alt="bubble" className="img-fluid position-absolute bottom-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUp;