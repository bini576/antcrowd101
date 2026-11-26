package routes

import (
	"github.com/gin-gonic/gin"

	"vdp-service/handlers"
	"vdp-service/middleware"
)

func Register(r *gin.Engine, h *handlers.Handler, rl *middleware.RateLimiter) {
	api := r.Group("/api/vdp")

	// Health and readiness endpoints
	api.GET("/health", func(c *gin.Context) { c.String(200, "OK") })
	api.GET("/ready", func(c *gin.Context) {
		if err := h.DB.Ping(c.Request.Context()); err != nil {
			c.Status(503)
			return
		}
		c.String(200, "OK")
	})

	// Public
	api.POST("/auth/login", h.LoginAuthUser)
	api.POST("/auth/bootstrap", h.BootstrapAuthUser)
	api.POST("/auth/register", h.RegisterAuthUser)
	api.GET("/public/security/:organization", h.GetPublicVDP)
	api.POST("/public/reports", rl.Middleware(), h.SubmitVulnerabilityReport)
	api.GET("/organizations", h.ListOrganizations)
	api.GET("/organizations/:id", h.GetOrganizationPublic)
	api.GET("/procedures/template", h.GetProcedureTemplate)
	api.GET("/organizations/:id/procedure", h.GetProcedureByOrg)
	api.GET("/programs", h.ListPublicPrograms)
	api.POST("/reports", rl.Middleware(), h.SubmitReportPublic)
	api.GET("/reports/:id/status", h.GetPublicReportStatus)
	api.POST("/reports/:id/comments", h.AddReportCommentPublic)
	api.GET("/reports/:id/comments", h.ListReportCommentsPublic)
	api.POST("/reports/:id/attachments", rl.Middleware(), h.UploadReportAttachmentPublic)
	api.GET("/reports/:id/attachments", h.ListReportAttachmentsPublic)
	api.GET("/reports/:id/attachments/:attId", h.GetReportAttachment)
	api.GET("/procedures/:id/document", h.GetProcedureDocument)

	// Protected
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware())
	protected.GET("/auth/me", h.GetCurrentAuthUser)

	org := protected.Group("")
	org.Use(middleware.RequireRole("organization_admin"))
	org.GET("/org/profile", h.GetOrgProfile)
	org.PUT("/org/profile", h.UpdateOrgProfile)
	org.GET("/org/settings", h.GetOrgSettings)
	org.PUT("/org/settings", h.UpdateOrgSettings)
	org.GET("/org/vdp", h.GetOrgVDP)
	org.GET("/org/notifications", h.ListOrgNotifications)
	org.PATCH("/org/notifications/:id/read", h.MarkNotificationRead)
	org.POST("/procedures", h.CreateProcedure)
	org.PUT("/procedures/:id", h.UpdateProcedure)
	org.POST("/procedures/:id/document", h.UploadProcedureDocument)
	org.POST("/org-admin/programs", h.CreateVDPProgram)
	org.PATCH("/org-admin/programs/:id/publish", h.PublishVDPProgram)
	org.POST("/programs", h.CreateProgram)
	org.PATCH("/programs/:id", h.UpdateProgram)
	org.GET("/org/metrics", h.GetOrgMetrics)
	org.GET("/org/reports", h.ListOrgReports)
	org.GET("/org/reports/export", h.ExportOrgReportsCSV)
	org.GET("/org/reports/:id", h.GetOrgReport)
	org.GET("/org/reports/:id/triage", h.GetReportTriageAssessmentOrg)
	org.POST("/org/reports/:id/triage/run", h.RunReportTriageAssessmentOrg)
	org.GET("/org/reports/:id/comments", h.ListReportCommentsOrg)
	org.GET("/org/reports/:id/events", h.ListReportEventsOrg)
	org.GET("/org/reports/:id/attachments", h.ListReportAttachmentsOrg)
	org.GET("/org/reports/:id/attachments/:attId", h.GetReportAttachmentOrg)
	org.PATCH("/reports/:id/status", h.UpdateReportStatus)
	org.PATCH("/org/reports/:id/assignee", h.AssignReportOrg)
	org.POST("/org/reports/:id/comments", h.AddReportCommentOrg)
	org.POST("/org/reports/:id/message", h.SendReportMessageOrg)

	hacker := protected.Group("")
	hacker.Use(middleware.RequireRole("hacker"))
	hacker.POST("/procedures/:id/accept", h.AcceptProcedure)
	hacker.GET("/my-reports", h.ListMyReports)

	admin := protected.Group("")
	admin.Use(middleware.RequireRole("platform_admin"))
	admin.GET("/admin/orgs", h.ListAdminOrganizations)
	admin.GET("/admin/programs", h.ListAdminPrograms)
	admin.PATCH("/admin/programs/:id", h.UpdateAdminProgram)
	admin.GET("/admin/reports", h.ListAdminReports)
	admin.GET("/admin/audit", h.ListAdminEvents)

	auth := r.Group("/auth")
	auth.POST("/login", h.LoginAuthUser)
	auth.POST("/register", h.RegisterAuthUser)
	auth.GET("/me", middleware.AuthMiddleware(), h.GetCurrentAuthUser)

	// Refactored public routes (compatibility aliases)
	public := r.Group("/public")
	public.GET("/security/:organization", h.GetPublicVDP)
	public.POST("/reports", rl.Middleware(), h.SubmitVulnerabilityReport)
	public.GET("/organizations", h.ListOrganizations)
	public.GET("/organizations/:id", h.GetOrganizationPublic)
	public.GET("/organizations/:id/procedure", h.GetProcedureByOrg)
	public.GET("/programs", h.ListPublicPrograms)
	public.GET("/reports/:id/status", h.GetPublicReportStatus)
	public.POST("/reports/:id/comments", h.AddReportCommentPublic)
	public.GET("/reports/:id/comments", h.ListReportCommentsPublic)
	public.POST("/reports/:id/attachments", rl.Middleware(), h.UploadReportAttachmentPublic)
	public.GET("/reports/:id/attachments", h.ListReportAttachmentsPublic)
	public.GET("/reports/:id/attachments/:attId", h.GetReportAttachment)
	public.GET("/procedures/:id/document", h.GetProcedureDocument)

	// Refactored organization admin routes (compatibility aliases)
	orgAdmin := r.Group("/org-admin")
	orgAdmin.Use(middleware.AuthMiddleware(), middleware.RequireRole("organization_admin"))
	orgAdmin.GET("/profile", h.GetOrgProfile)
	orgAdmin.PUT("/profile", h.UpdateOrgProfile)
	orgAdmin.GET("/settings", h.GetOrgSettings)
	orgAdmin.PUT("/settings", h.UpdateOrgSettings)
	orgAdmin.GET("/vdp", h.GetOrgVDP)
	orgAdmin.POST("/procedures", h.CreateProcedure)
	orgAdmin.PUT("/procedures/:id", h.UpdateProcedure)
	orgAdmin.POST("/procedures/:id/document", h.UploadProcedureDocument)
	orgAdmin.POST("/programs", h.CreateVDPProgram)
	orgAdmin.PATCH("/programs/:id/publish", h.PublishVDPProgram)
	orgAdmin.PATCH("/programs/:id", h.UpdateProgram)
	orgAdmin.GET("/metrics", h.GetOrgMetrics)
	orgAdmin.GET("/reports", h.ListOrgReports)
	orgAdmin.GET("/reports/export", h.ExportOrgReportsCSV)
	orgAdmin.GET("/reports/:id", h.GetOrgReport)
	orgAdmin.GET("/reports/:id/triage", h.GetReportTriageAssessmentOrg)
	orgAdmin.POST("/reports/:id/triage/run", h.RunReportTriageAssessmentOrg)
	orgAdmin.PATCH("/reports/:id/status", h.UpdateReportStatus)
	orgAdmin.PATCH("/reports/:id/assignee", h.AssignReportOrg)
	orgAdmin.POST("/reports/:id/comments", h.AddReportCommentOrg)
	orgAdmin.POST("/reports/:id/message", h.SendReportMessageOrg)
	orgAdmin.GET("/notifications", h.ListOrgNotifications)
	orgAdmin.PATCH("/notifications/:id/read", h.MarkNotificationRead)

	// Compliance summary — session-based auth handled inside the handler itself.
	// Moved out of the JWT-protected group so GRC users with a platform session
	// cookie (no VDP JWT) can access aggregate metrics directly.
	api.GET("/compliance/summary", h.GetComplianceSummary)

	// Developer reports — session-based auth, allows developer platformRole to
	// read all VDP reports without needing a VDP JWT.
	api.GET("/developer/reports", h.GetDeveloperReports)
}
