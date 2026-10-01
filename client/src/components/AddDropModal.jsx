import React from "react";

export default function AddDropModal({
  course,
  advisorEmail,
  studentId,
  onClose,
}) {
  const subject = `Add/Drop Request - ${studentId} - ${course.code}`;
  const mailtoUrl = `mailto:${advisorEmail}?subject=${encodeURIComponent(subject)}`;

  return (
    <div
      className="modal d-block add-drop-modal"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-drop-modal-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id="add-drop-modal-title">
              Add / Drop Request — {course.code}
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <ol className="mb-0">
              <li>Download and open the Add/Drop Request form.</li>
              <li>
                Fill in your student ID, name, term, and the course code and
                section you wish to add or drop.
              </li>
              <li>State the reason for the request and sign the form.</li>
              <li>
                Email the completed form as an attachment to your advisor at{" "}
                <strong>{advisorEmail}</strong>, using the subject line:
                <br />
                <code className="bg-body-secondary px-2 py-1 rounded d-inline-block mt-1">
                  {subject}
                </code>
              </li>
              <li>
                Your advisor will confirm by email once the change is made.
              </li>
            </ol>
          </div>
          <div className="modal-footer">
            <a
              href="/Add_Drop_Form.pdf"
              download
              className="btn btn-primary"
            >
              Download Add/Drop Form
            </a>
            <a href={mailtoUrl} className="btn btn-success">
              Send Email to Advisor
            </a>
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
