import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { isFeBugEnabled } from "../lib/bugs";
import { apiRequest, ApiError } from "../lib/http";

type RegisterPageProps = {
  onRegister: (token: string) => void;
};

type RegisterResponse = {
  token: string;
};

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegisterPage = ({ onRegister }: RegisterPageProps): JSX.Element => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();
  const toast = useToast();

  const computeErrors = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (email.trim() === "") {
      errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  };

  const validate = (): boolean => {
    const errors = computeErrors();
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const registerMutation = useMutation({
    mutationFn: (payload: { name?: string; email: string; password: string }) =>
      apiRequest<RegisterResponse>("/auth/register", {
        method: "POST",
        body: payload,
      }),
    onSuccess: (data) => {
      onRegister(data.token);
      toast.success("Account created successfully.");
      navigate("/courses", { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const hasValidationErrors = Object.keys(computeErrors()).length > 0;
  const skipValidationDisable = isFeBugEnabled("FE_BUG_FORM_NO_VALIDATION");
  const submitDisabled =
    registerMutation.isPending || (!skipValidationDisable && hasValidationErrors);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!validate()) return;

    const payload: { name?: string; email: string; password: string } = {
      email,
      password,
    };
    if (name.trim() !== "") {
      payload.name = name.trim();
    }
    registerMutation.mutate(payload);
  };

  return (
    <section className="panel" data-testid="page-register">
      <h1>Create an account</h1>
      <form className="form" data-testid="form-register" onSubmit={onSubmit}>
        <label>
          Name (optional)
          <input
            type="text"
            data-testid="input-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {fieldErrors.name ? (
          <p className="error" data-testid="error-name">
            {fieldErrors.name}
          </p>
        ) : null}

        <label>
          Email
          <input
            type="email"
            data-testid="input-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {fieldErrors.email ? (
          <p className="error" data-testid="error-email">
            {fieldErrors.email}
          </p>
        ) : null}

        <label>
          Password
          <input
            type="password"
            data-testid="input-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {fieldErrors.password ? (
          <p className="error" data-testid="error-password">
            {fieldErrors.password}
          </p>
        ) : null}

        <label>
          Confirm Password
          <input
            type="password"
            data-testid="input-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        {fieldErrors.confirmPassword ? (
          <p className="error" data-testid="error-confirmPassword">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}

        <button type="submit" data-testid="btn-register" disabled={submitDisabled}>
          {registerMutation.isPending ? "Creating account..." : "Register"}
        </button>
      </form>

      {registerMutation.error ? (
        <p className="error">{(registerMutation.error as ApiError).message}</p>
      ) : null}

      <p>
        Already have an account?{" "}
        <Link to="/login" data-testid="link-login">
          Sign in
        </Link>
      </p>
    </section>
  );
};

export default RegisterPage;
