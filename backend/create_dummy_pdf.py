from reportlab.pdfgen import canvas

def create_pdf():
    c = canvas.Canvas("timetable.pdf")
    c.drawString(100, 800, "My Fall Schedule")
    
    # Let's create a late class that ends at 8:15 PM (20:15) to trigger the smart mess warning
    c.drawString(100, 750, "Monday")
    c.drawString(120, 730, "10:00-11:00 - Physics Lecture")
    c.drawString(120, 710, "19:00-20:15 - Late Night Lab")

    c.drawString(100, 680, "Wednesday")
    c.drawString(120, 660, "14:00-15:30 - Data Structures")

    c.save()

if __name__ == "__main__":
    create_pdf()
