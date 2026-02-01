import { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'

const initialState = {
  email: '',
  password: '',
}

export default function Login() {
  const { loginPending, loginError, login } = useContext(AuthContext)
  const [state, setState] = useState(initialState)
  const navigate = useNavigate()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { email, password } = state
    login(email, password, (error: any) => {
      if (!error) {
        navigate('/')
      }
    })
    setState({
      email: '',
      password: '',
    })
  }

  return (
    <div className="container px-4 py-5 px-md-5 text-center text-lg-start my-5">
      <div className="row gx-lg-5 align-items-center mb-5">
        <div className="col-lg-6 mb-5 mb-lg-0" style={{ zIndex: '10' }}>
          <h1 className="my-5 display-5 fw-bold ls-tight text-slate-800">
            Welcome to <br />
            <span className="text-primary">Board Game App</span>
          </h1>
          <p className="mb-4 text-slate-600">
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
              <form name="loginForm" onSubmit={onSubmit}>
                <div className="row">
                  <div className="col-sm-3 col-md-6"></div>

                  <div className="form-outline mb-4">
                    <label className="form-label text-dark" htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      className="form-control border border-slate-300 text-slate-900"
                      type="email"
                      name="email"
                      autoComplete="email"
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, email: e.target.value }))
                      }
                      value={state.email}
                      placeholder="email"
                      aria-required="true"
                    />
                  </div>

                  <div className="form-outline mb-4">
                    <label className="form-label text-dark" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      className="form-control border border-slate-300 text-slate-900"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      value={state.password}
                      placeholder="password"
                      aria-required="true"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block mb-4"
                    disabled={loginPending}
                  >
                    {loginPending ? 'Logging in...' : 'Login'}
                  </button>

                  <div className="text-center">
                    <p className="text-slate-700 mb-0">
                      Don't have an account yet?{' '}
                      <Link to="/register" className="text-primary fw-medium">
                        Register
                      </Link>
                    </p>
                  </div>
                </div>
                {loginError && (
                  <div
                    className="text-danger mt-2"
                    role="alert"
                    aria-live="polite"
                  >
                    {loginError.message || 'Login failed'}
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
