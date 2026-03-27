import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { apiRequest, ApiError } from "../lib/http";
import { MeResponse } from "../lib/types";

type ProfilePageProps = {
  token: string | null;
};

type ProfileResponse = {
  data: MeResponse;
};

const ProfilePage = ({ token }: ProfilePageProps): JSX.Element => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", token],
    queryFn: ({ signal }) =>
      apiRequest<MeResponse>("/auth/me", {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setEditName(profileQuery.data.name ?? "");
      setEditBio(profileQuery.data.bio ?? "");
    }
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: { name?: string; bio?: string }) =>
      apiRequest<ProfileResponse>("/auth/me", {
        method: "PATCH",
        token,
        body: payload,
      }),
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const handleEdit = (): void => {
    if (profileQuery.data) {
      setEditName(profileQuery.data.name ?? "");
      setEditBio(profileQuery.data.bio ?? "");
    }
    setIsEditing(true);
  };

  const handleCancelEdit = (): void => {
    setIsEditing(false);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    updateMutation.mutate({
      name: editName.trim() || undefined,
      bio: editBio.trim() || undefined,
    });
  };

  if (!token) {
    return (
      <section className="panel" data-testid="page-profile">
        <h1>Profile</h1>
        <p>
          You need to <Link to="/login">sign in</Link> to view your profile.
        </p>
      </section>
    );
  }

  if (profileQuery.isPending) {
    return (
      <section className="panel" data-testid="page-profile">
        <h1>Profile</h1>
        <p>Loading profile...</p>
      </section>
    );
  }

  if (profileQuery.error) {
    return (
      <section className="panel" data-testid="page-profile">
        <h1>Profile</h1>
        <p className="error">Failed to load profile.</p>
      </section>
    );
  }

  const profile = profileQuery.data;

  return (
    <section className="panel" data-testid="page-profile">
      <h1>Profile</h1>

      {isEditing ? (
        <form className="form" data-testid="form-profile" onSubmit={onSubmit}>
          <label>
            Name
            <input
              type="text"
              data-testid="input-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </label>

          <label>
            Bio
            <textarea
              data-testid="input-bio"
              value={editBio}
              onChange={(event) => setEditBio(event.target.value)}
              rows={4}
            />
          </label>

          <p data-testid="profile-email">
            <strong>Email:</strong> {profile.email}
          </p>

          <p data-testid="profile-role">
            <strong>Role:</strong>{" "}
            <span className="badge">{profile.role}</span>
          </p>

          <div className="button-row">
            <button
              type="submit"
              data-testid="btn-save-profile"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              data-testid="btn-cancel-edit"
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card" data-testid="profile-display">
          <dl>
            <dt>Name</dt>
            <dd data-testid="profile-name">{profile.name ?? "—"}</dd>

            <dt>Email</dt>
            <dd data-testid="profile-email">{profile.email}</dd>

            <dt>Role</dt>
            <dd data-testid="profile-role">
              <span className="badge">{profile.role}</span>
            </dd>

            <dt>Bio</dt>
            <dd data-testid="profile-bio">{profile.bio ?? "—"}</dd>
          </dl>

          <button
            type="button"
            data-testid="btn-edit-profile"
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>
      )}

      {updateMutation.error ? (
        <p className="error">{(updateMutation.error as ApiError).message}</p>
      ) : null}
    </section>
  );
};

export default ProfilePage;
