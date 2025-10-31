import React from "react";
import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Departments from "./Departments";

import AddDepartment from "./AddDepartment";

import AddRisk from "./AddRisk";

import DepartmentRisks from "./DepartmentRisks";

import AllRisks from "./AllRisks";

import Register from "./Register";

import InvitationCodes from "./InvitationCodes";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {

    Dashboard: Dashboard,

    Departments: Departments,

    AddDepartment: AddDepartment,

    AddRisk: AddRisk,

    DepartmentRisks: DepartmentRisks,

    AllRisks: AllRisks,

    InvitationCodes: InvitationCodes,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const [theme, setTheme] = React.useState("dark");

    React.useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') || 'dark';
        setTheme(savedTheme);
    }, []);

    const toggleTheme = () => {
        setTheme(currentTheme => {
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('app-theme', newTheme);
            return newTheme;
        });
    };

    return (
        <Routes>
            {/* Public routes - outside Layout */}
            <Route path="/register" element={<Register theme={theme} toggleTheme={toggleTheme} />} />

            {/* Protected routes - inside Layout */}
            <Route path="/" element={
                <Layout currentPageName={currentPage}>
                    <Dashboard />
                </Layout>
            } />
            <Route path="/Dashboard" element={
                <Layout currentPageName={currentPage}>
                    <Dashboard />
                </Layout>
            } />
            <Route path="/Departments" element={
                <Layout currentPageName={currentPage}>
                    <Departments />
                </Layout>
            } />
            <Route path="/AddDepartment" element={
                <Layout currentPageName={currentPage}>
                    <AddDepartment />
                </Layout>
            } />
            <Route path="/AddRisk" element={
                <Layout currentPageName={currentPage}>
                    <AddRisk />
                </Layout>
            } />
            <Route path="/DepartmentRisks" element={
                <Layout currentPageName={currentPage}>
                    <DepartmentRisks />
                </Layout>
            } />
            <Route path="/AllRisks" element={
                <Layout currentPageName={currentPage}>
                    <AllRisks />
                </Layout>
            } />
            <Route path="/InvitationCodes" element={
                <Layout currentPageName={currentPage}>
                    <InvitationCodes />
                </Layout>
            } />
        </Routes>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}