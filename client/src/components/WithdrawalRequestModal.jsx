import React, { useState } from "react";
import { apiFetch } from "../api";

export default function WithdrawalRequestModal({
  registration,
  onClose,
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const offering = registration.offeringId;
  const course = offering?.courseId;

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      await apiFetch("/students/me/withdrawal-request-telegram", {
        method: "POST",
        body: JSON.stringify({
          registrationId: registration._id,
          message: message.trim(),
        }),
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal d-block withdrawal-request-modal"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-request-modal-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id="withdraw-request-modal-title">
              Withdraw Request — {course?.code}
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            {sent ? (
              <>
                <div className="alert alert-success mb-3" role="status">
                  Request sent to your advisor on Telegram.
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-secondary">
                  Your advisor will review your request.
                </p>
                <p className="mb-2">
                  Course: <strong>{course?.code} — {course?.title}</strong>{" "}
                  (Section {offering.section}, {offering.term})
                </p>
                <label
                  htmlFor="withdrawal-request-reason"
                  className="form-label fw-semibold mt-2"
                >
                  Reason
                </label>
                <textarea
                  id="withdrawal-request-reason"
                  className="form-control"
                  rows="5"
                  maxLength="3000"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Why do you want to withdraw?"
                  required
                />
                {error && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            {!sent && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending || !message.trim()}
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
