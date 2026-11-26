# InsurancePortal.UI

A modern web-based Insurance Portal UI built with ASP.NET Core and .NET 10. This project provides the foundation for developing a user-friendly insurance application, with a dedicated frontend and a scalable structure for future integration with insurance business services and APIs.

## Overview

InsurancePortal.UI is a web application project focused on the user interface layer of an insurance portal.

The goal of this project is to provide a clean and extensible foundation for building digital insurance experiences, simplifying user interactions and supporting the development of insurance-related workflows.

The application can be extended to support insurance operations such as policy management, customer information, claims processing, and other insurance services as the project evolves.

## Project Goals

- Build a modern and user-friendly insurance portal.
- Maintain a clear separation between the web application host and frontend application.
- Establish a foundation for API-based integration with backend services.
- Follow maintainable and extensible application development practices.
- Explore modern Microsoft .NET technologies through a practical insurance domain project.

## Technology Stack

- **Framework:** ASP.NET Core
- **Platform:** .NET 10
- **Language:** C#
- **Frontend:** ClientApp, Angular
- **Project Configuration:** Nullable reference types and implicit global usings enabled

## Project Structure

```text
InsurancePortal.UI/
│
├── ClientApp/                  # Frontend application
│
├── Properties/                 # Application launch settings
│
├── Program.cs                  # ASP.NET Core application entry point
│
├── appsettings.json            # Application configuration
│
├── appsettings.Development.json
│                               # Development configuration
│
├── InsurancePortal.UI.csproj   # Project file
│
└── InsurancePortal.UI.slnx      # Solution file
```

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Visual Studio 2022 or Visual Studio Code
- Git

### Clone the Repository

```bash
git clone https://github.com/krutalmodi/InsurancePortal.UI.git

cd InsurancePortal.UI
```

### Restore Dependencies

```bash
dotnet restore
```

### Run the Application

```bash
dotnet run
```

Open the local URL displayed in your terminal to access the application.

## Configuration

Application settings are maintained in:

- `appsettings.json`
- `appsettings.Development.json`

Use these files to configure application-specific settings for development and deployment environments.

Avoid storing passwords, API keys, or other sensitive credentials directly in configuration files committed to source control.

## Future Enhancements

The project can be extended with features such as:

- Customer registration and authentication
- Insurance policy browsing and management
- Insurance quote generation
- Claims submission and tracking
- Customer dashboard
- Integration with ASP.NET Core Web APIs
- Responsive UI for desktop and mobile devices

## Development

This repository is intended to serve as a foundation for continuous development and experimentation with modern web application architecture using the Microsoft technology stack.

Contributions, suggestions, and improvements are welcome.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

See [LICENSE.txt](LICENSE.txt) for details.

---

Developed by [krutalmodi](https://github.com/krutalmodi)
