export const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export const formatTime = (timeString: string) => {
    const date = new Date(timeString);

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export const formatCurrency = (amount: number) => {
    const num = Number(amount);
    const rounded = isNaN(num) ? 0 : Math.round(num);

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(rounded);
};

export const LocalTime = (dateObj: Date | string | number) => {
    const receivedDate = dateObj ? new Date(dateObj) : new Date();
    return receivedDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const calculateDuration = (
    start: Date | string | number,
    end: Date | string | number,
) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);

    return `${hours}h ${minutes}m`;
};
