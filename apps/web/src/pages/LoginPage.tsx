import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { isUiBugModeEnabled } from "../lib/bugs";
import { apiRequest, ApiError } from "../lib/http";

type LoginPageProps = {
  onLogin: (token: string) => void;
};

type LoginResponse = {
  token: string;
};

const LoginPage = ({ onLogin }: LoginPageProps): JSX.Element => {
  const [email, setEmail] = useState("student@qualitycat.academy");
  const [password, setPassword] = useState("student123");
  const navigate = useNavigate();
  const toast = useToast();

  const loginMutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: payload,
      }),
    onSuccess: (data) => {
      onLogin(data.token);
      toast.success("Signed in successfully.");
      navigate("/courses", { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const payload = { email, password };
    loginMutation.mutate(payload);

    if (isUiBugModeEnabled()) {
      loginMutation.mutate(payload);
    }
  };

  return (
    <section className="panel">
      <h1>Login</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {loginMutation.error ? (
        <p className="error">{(loginMutation.error as ApiError).message}</p>
      ) : null}
    </section>
  );
};

export default LoginPage;
