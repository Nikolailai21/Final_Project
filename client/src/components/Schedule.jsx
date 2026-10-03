import React from "react";
import "./Schedule.css";

const Schedule = ({ registrations }) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const startHour = 8; // Schedule starts at 8:00 AM
    const endHour = 18;  // Schedule ends at 6:00 PM

    // Generate array of hours [8, 9, 10, ... 18]
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);

    // Only display actively registered classes that have a valid offering assigned
    const activeClasses = registrations.filter(
        (reg) => reg.status === "registered" && reg.offeringId
    );

    const getPositionStyle = (startTime, endTime) => {
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            return hours + minutes / 60;
        };

        const start = parseTime(startTime);
        const end = parseTime(endTime);

        // 60px equals 1 hour based on our CSS .time-slot
        const topOffset = (start - startHour) * 60;
        const height = (end - start) * 60;

        return {
            top: `${topOffset}px`,
            height: `${height}px`,
        };
    };

    return (
        <div className="schedule-container bg-white p-4 rounded-4 shadow-sm border mt-4 mb-4">
            <h3 className="fs-5 fw-bold mb-4 text-dark">My Class Schedule (Next Term)</h3>

            <div className="schedule-wrapper">
                <div className="schedule-grid">
                    {/* Top-left empty corner */}
                    <div className="time-col-header"></div>

                    {/* Top row: Day Headers */}
                    {days.map((day) => (
                        <div key={day} className="day-header fw-bold text-center py-2">
                            {day}
                        </div>
                    ))}

                    {/* Left column: Time labels */}
                    <div className="time-col">
                        {hours.map((hour) => (
                            <div key={hour} className="time-slot text-end pe-2">
                                {/* Don't show the bottom-most label to prevent clipping */}
                                {hour !== endHour && (
                                    <span className="time-label">{`${hour}:00`}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Schedule Body: Columns for each day */}
                    {days.map((day) => (
                        <div key={day} className="day-col">

                            {/* Background horizontal grid lines */}
                            {hours.map((hour) => (
                                <div key={hour} className="grid-cell"></div>
                            ))}

                            {/* Render the courses on top of the grid */}
                            {activeClasses
                                .filter((cls) => cls.offeringId.day === day)
                                .map((cls) => {
                                    const offering = cls.offeringId;
                                    const course = offering.courseId;
                                    return (
                                        <div
                                            key={cls._id}
                                            className="class-card text-white rounded p-2"
                                            style={getPositionStyle(
                                                offering.startTime,
                                                offering.endTime
                                            )}
                                            title={`${course?.title} \n${offering.startTime} - ${offering.endTime}`}
                                        >
                                            <div className="fw-bold fs-7 text-truncate">
                                                {course?.code} - Sec {offering.section}
                                            </div>
                                            <div className="fs-8 text-truncate mb-1">
                                                {course?.title}
                                            </div>
                                            <div className="fs-8 opacity-75 mt-auto text-truncate">
                                                <i className="bi bi-clock me-1"></i>
                                                {offering.startTime} - {offering.endTime}
                                            </div>
                                            <div className="fs-8 opacity-75 text-truncate">
                                                <i className="bi bi-geo-alt me-1"></i>
                                                {offering.room}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Schedule;