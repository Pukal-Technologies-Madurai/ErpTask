import { useState, useEffect } from "react";

interface UsePaginationProps<T> {
    data: T[];
    itemsPerPage: number;
    initialPage?: number;
}

interface PaginationResult<T> {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    totalRecords: number;
    currentData: T[];
    setCurrentPage: (page: number) => void;
}

export function usePagination<T>({
    data,
    itemsPerPage,
    initialPage = 1,
}: UsePaginationProps<T>): PaginationResult<T> {
    const [currentPage, setCurrentPage] = useState(initialPage);

    // Reset to first page when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    const totalRecords = data.length;
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = data.slice(startIndex, endIndex);

    return {
        currentPage,
        totalPages,
        totalItems: data.length,
        totalRecords,
        currentData,
        setCurrentPage,
    };
}
