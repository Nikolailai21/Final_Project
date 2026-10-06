import { useState } from "react";
import { apiFetch } from "../api";

export default function WithdrawalRequestModal({
  registration,
  onClose,
}) {
  const [requestType, setRequestType] = useState("drop");
  const [availableOfferings, setAvailableOfferings] = useState([]);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [offeringsError, setOfferingsError] = useState("");
  const [targetOfferingId, setTargetOfferingId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const offering = registration.offeringId;
  const course = offering?.courseId;
  const alternativeOfferings = availableOfferings.filter(
    (availableOffering) =>
      String(availableOffering.courseId?._id || availableOffering.courseId) ===
        String(course?._id) &&
      String(availableOffering._id) !== String(offering?._id),
  );

  const handleRequestTypeChange = async (nextRequestType) => {
    setRequestType(nextRequestType);
    setTargetOfferingId("");
    if (nextRequestType !== "change_section") return;

    setOfferingsLoading(true);
    setOfferingsError("");
    try {
      const offerings = await apiFetch(
        `/offerings/open?term=${encodeURIComponent(registration.term)}`,
      );
      setAvailableOfferings(offerings);
    } catch (err) {
      setOfferingsError(
        err.message || "Unable to load open sections for this course.",
      );
    } finally {
      setOfferingsLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      await apiFetch("/students/me/withdrawal-request-telegram", {
        method: "POST",
        body: JSON.stringify({
          registrationId: registration._id,
          requestType,
          ...(requestType === "change_section" ? { targetOfferingId } : {}),
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
              Course Request — {course?.code}
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
                  htmlFor="course-change-request-type"
                  className="form-label fw-semibold mt-2"
                >
                  Request type
                </label>
                <select
                  id="course-change-request-type"
                  className="form-select"
                  value={requestType}
                  onChange={(event) =>
                    handleRequestTypeChange(event.target.value)
                  }
                >
                  <option value="drop">Drop this course</option>
                  <option value="change_section">Change section</option>
                </select>
                {requestType === "change_section" && (
                  <div className="mt-3">
                    <label
                      htmlFor="course-change-target-section"
                      className="form-label fw-semibold"
                    >
                      Preferred section
                    </label>
                    <select
                      id="course-change-target-section"
                      className="form-select"
                      value={targetOfferingId}
                      onChange={(event) =>
                        setTargetOfferingId(event.target.value)
                      }
                      disabled={offeringsLoading || Boolean(offeringsError)}
                      required
                    >
                      <option value="">
                        {offeringsLoading
                          ? "Loading open sections..."
                          : "Select an open section"}
                      </option>
                      {alternativeOfferings.map((alternativeOffering) => (
                        <option
                          value={alternativeOffering._id}
                          key={alternativeOffering._id}
                        >
                          Section {alternativeOffering.section} —{" "}
                          {alternativeOffering.day}{" "}
                          {alternativeOffering.startTime}-
                          {alternativeOffering.endTime}, Room{" "}
                          {alternativeOffering.room}
                        </option>
                      ))}
                    </select>
                    {offeringsError ? (
                      <p className="small text-danger mt-1 mb-0" role="alert">
                        {offeringsError}
                      </p>
                    ) : !offeringsLoading &&
                      alternativeOfferings.length === 0 ? (
                      <p className="small text-secondary mt-1 mb-0">
                        There are no other open sections for this course.
                      </p>
                    ) : null}
                  </div>
                )}
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
                  placeholder={
                    requestType === "drop"
                      ? "Why do you want to drop this course?"
                      : "Why do you want to change sections?"
                  }
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
                disabled={
                  sending ||
                  !message.trim() ||
                  (requestType === "change_section" &&
                    (offeringsLoading ||
                      Boolean(offeringsError) ||
                      !targetOfferingId))
                }
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
