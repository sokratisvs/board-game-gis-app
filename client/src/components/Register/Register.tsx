import { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext, LoginErrorType } from '../../context/Auth.context'

const initialState = {
  name: '',
  email: '',
  password: '',
  type: '',
}

const userTypes = ['user', 'shop', 'event', 'admin']

export default function Register() {
  const { loginPending, loginError, register } = useContext(AuthContext)
  const [state, setState] = useState(initialState)
  const navigate = useNavigate()

  const handleTypeChange = (e: { target: { value: any } }) => {
    setState((prev) => ({ ...prev, type: e.target.value }))
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { name, email, password, type } = state
    register(
      name,
      email,
      password,
      type || undefined,
      (error: LoginErrorType) => {
        if (!error) {
          navigate('/login')
        }
      }
    )
    setState(initialState)
  }

  return (
    <div className="container px-4 py-5 px-md-5 text-center text-lg-start my-5">
      <div className="row gx-lg-5 align-items-center mb-5">
        <div className="col-lg-6 mb-5 mb-lg-0" style={{ zIndex: '10' }}>
          <h1
            className="my-5 display-5 fw-bold ls-tight"
            style={{ color: 'hsl(218, 81%, 95%)' }}
          >
            Welcome to <br />
            <span style={{ color: 'hsl(218, 81%, 75%)' }}>Board Game App</span>
          </h1>
          <p
            className="mb-4 opacity-70"
            style={{ color: 'hsl(218, 81%, 85%)' }}
          >
            Lorem ipsum dolor, sit amet consectetur adipisicing elit.
            Temporibus, expedita iusto veniam atque, magni tempora mollitia
            dolorum consequatur nulla, neque debitis eos reprehenderit quasi ab
            ipsum nisi dolorem modi. Quos?
          </p>
        </div>

        <div className="col-lg-6 mb-5 mb-lg-0 position-relative">
          <div
            id="radius-shape-1"
            className="position-absolute rounded-circle shadow-5-strong"
          ></div>
          <div
            id="radius-shape-2"
            className="position-absolute shadow-5-strong"
          ></div>

          <div className="card bg-glass">
            <div className="card-body px-4 py-5 px-md-5">
              <form name="registerForm" onSubmit={onSubmit}>
                <div className="row">
                  <div className="form-outline mb-4">
                    <label className="form-label" htmlFor="username">
                      Full Name
                    </label>
                    <input
                      id="username"
                      className="form-control"
                      type="text"
                      name="name"
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, name: e.target.value }))
                      }
                      value={state.name}
                      placeholder="username"
                    />
                  </div>

                  <div className="form-outline mb-4">
                    <label className="form-label" htmlFor="email">
                      Username
                    </label>
                    <input
                      id="email"
                      className="form-control"
                      type="email"
                      name="email"
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, email: e.target.value }))
                      }
                      value={state.email}
                      placeholder="email"
                    />
                  </div>

                  <div className="form-outline mb-4">
                    <label className="form-label" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      className="form-control"
                      type="password"
                      name="password"
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      value={state.password}
                      placeholder="password"
                    />
                  </div>

                  <div className="form-outline mb-4">
                    <label className="form-label" htmlFor="userType">
                      Select User Type
                    </label>
                    <select
                      id="userType"
                      className="form-control"
                      value={state.type}
                      onChange={handleTypeChange}
                    >
                      <option value="">-- Select Type --</option>
                      {userTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block mb-4"
                    disabled={loginPending || !state.type}
                  >
                    {loginPending ? 'Signing up...' : 'Sign Up'}
                  </button>

                  <div className="text-center">
                    <p>
                      Already have an account? <Link to="/login">Login</Link>
                    </p>
                  </div>
                </div>
                {loginError && (
                  <div className="text-danger">
                    {loginError.message || 'Registration failed'}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
