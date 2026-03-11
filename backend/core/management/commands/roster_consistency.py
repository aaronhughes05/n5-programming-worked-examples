from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Classroom, Enrollment, Profile, TeacherStudent


class Command(BaseCommand):
    help = "Audit and optionally repair classroom/enrollment/teacher-student consistency."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply safe consistency fixes.",
        )
        parser.add_argument(
            "--teacher",
            type=str,
            help="Limit checks/fixes to a single teacher username.",
        )
        parser.add_argument(
            "--prune-orphans",
            action="store_true",
            help="Delete TeacherStudent links that have no matching enrollment (requires --apply).",
        )
        parser.add_argument(
            "--sync-roles",
            action="store_true",
            help="Align teacher/student roles from roster relationships (requires --apply).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        apply_changes = bool(options.get("apply"))
        teacher_username = str(options.get("teacher") or "").strip()
        prune_orphans = bool(options.get("prune_orphans"))
        sync_roles = bool(options.get("sync_roles"))

        if (prune_orphans or sync_roles) and not apply_changes:
            self.stderr.write(self.style.ERROR("--prune-orphans/--sync-roles require --apply."))
            return

        classrooms = Classroom.objects.select_related("teacher").all()
        enrollment_qs = Enrollment.objects.select_related("classroom", "classroom__teacher", "student").all()
        link_qs = TeacherStudent.objects.select_related("teacher", "student").all()

        if teacher_username:
            classrooms = classrooms.filter(teacher__username=teacher_username)
            enrollment_qs = enrollment_qs.filter(classroom__teacher__username=teacher_username)
            link_qs = link_qs.filter(teacher__username=teacher_username)

        classroom_rows = list(classrooms)
        enrollment_rows = list(enrollment_qs)
        link_rows = list(link_qs)

        enrollment_pairs = set((row.classroom.teacher_id, row.student_id) for row in enrollment_rows)
        link_pairs = set((row.teacher_id, row.student_id) for row in link_rows)

        missing_links = sorted(enrollment_pairs - link_pairs)
        orphan_links = sorted(link_pairs - enrollment_pairs)
        self_links = [row for row in link_rows if row.teacher_id == row.student_id]

        teacher_role_mismatches = []
        for classroom in classroom_rows:
            role = getattr(getattr(classroom.teacher, "profile", None), "role", Profile.ROLE_STUDENT)
            if role != Profile.ROLE_TEACHER:
                teacher_role_mismatches.append(classroom.teacher_id)
        teacher_role_mismatches = sorted(set(teacher_role_mismatches))

        invalid_student_rows = []
        for row in enrollment_rows:
            if row.student_id == row.classroom.teacher_id:
                invalid_student_rows.append(("same-as-teacher", row.classroom_id, row.student_id))
                continue
            role = getattr(getattr(row.student, "profile", None), "role", Profile.ROLE_STUDENT)
            if role != Profile.ROLE_STUDENT:
                invalid_student_rows.append(("non-student-role", row.classroom_id, row.student_id))

        self.stdout.write(self.style.NOTICE("Roster consistency report"))
        self.stdout.write(f"Mode: {'APPLY' if apply_changes else 'DRY-RUN'}")
        if teacher_username:
            self.stdout.write(f"Scoped teacher: {teacher_username}")
        self.stdout.write("")

        self.stdout.write(self.style.NOTICE("Counts"))
        self.stdout.write(f"  classrooms={len(classroom_rows)}")
        self.stdout.write(f"  enrollments={len(enrollment_rows)}")
        self.stdout.write(f"  teacher_student_links={len(link_rows)}")
        self.stdout.write(f"  missing_links={len(missing_links)}")
        self.stdout.write(f"  orphan_links={len(orphan_links)}")
        self.stdout.write(f"  self_links={len(self_links)}")
        self.stdout.write(f"  teacher_role_mismatches={len(teacher_role_mismatches)}")
        self.stdout.write(f"  invalid_enrollments={len(invalid_student_rows)}")

        if missing_links:
            self.stdout.write("  missing link samples:")
            for teacher_id, student_id in missing_links[:10]:
                self.stdout.write(f"    teacher_id={teacher_id}, student_id={student_id}")
        if orphan_links:
            self.stdout.write("  orphan link samples:")
            for teacher_id, student_id in orphan_links[:10]:
                self.stdout.write(f"    teacher_id={teacher_id}, student_id={student_id}")
        if invalid_student_rows:
            self.stdout.write("  invalid enrollment samples:")
            for reason, classroom_id, student_id in invalid_student_rows[:10]:
                self.stdout.write(f"    reason={reason}, classroom_id={classroom_id}, student_id={student_id}")

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Dry-run only. Re-run with --apply to persist repairs."))
            return

        created_links = 0
        deleted_orphans = 0
        updated_teacher_roles = 0
        updated_student_roles = 0

        for teacher_id, student_id in missing_links:
            _, created = TeacherStudent.objects.get_or_create(teacher_id=teacher_id, student_id=student_id)
            if created:
                created_links += 1

        if prune_orphans and orphan_links:
            orphan_set = set(orphan_links)
            delete_ids = [row.id for row in link_rows if (row.teacher_id, row.student_id) in orphan_set]
            if delete_ids:
                deleted_orphans, _ = TeacherStudent.objects.filter(id__in=delete_ids).delete()

        if sync_roles:
            teacher_ids = sorted(set(classroom.teacher_id for classroom in classroom_rows))
            enrolled_student_ids = sorted(set(row.student_id for row in enrollment_rows))
            teacher_id_set = set(teacher_ids)
            pure_student_ids = [sid for sid in enrolled_student_ids if sid not in teacher_id_set]

            if teacher_ids:
                updated_teacher_roles = Profile.objects.filter(user_id__in=teacher_ids).exclude(
                    role=Profile.ROLE_TEACHER
                ).update(role=Profile.ROLE_TEACHER)
            if pure_student_ids:
                updated_student_roles = Profile.objects.filter(user_id__in=pure_student_ids).exclude(
                    role=Profile.ROLE_STUDENT
                ).update(role=Profile.ROLE_STUDENT)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Apply summary"))
        self.stdout.write(f"  created_missing_links={created_links}")
        self.stdout.write(f"  deleted_orphan_links={deleted_orphans}")
        self.stdout.write(f"  updated_teacher_roles={updated_teacher_roles}")
        self.stdout.write(f"  updated_student_roles={updated_student_roles}")
